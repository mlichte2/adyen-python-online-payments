#!/usr/bin/env python3
"""
Generate a configuration catalog for Adyen Web components by fetching and
heuristically parsing the TypeScript source for a pinned adyen-web version.

Pure Python (stdlib + requests). No Node / TypeScript toolchain required.

    uv run tools/generate_config_catalog.py --version 6.44.0
    uv run tools/generate_config_catalog.py --version 6.44.0 --component Card

Output: app/config_catalog/<version>.json

IMPORTANT: TypeScript cannot be fully parsed without a real TS compiler, so this
is a best-effort extraction of each component's OWN config interface (props +
JSDoc @defaultValue / @internal / "merchant set config option" markers). It does
not resolve every inherited/imported type. The emitted JSON is meant to be
reviewed; the app treats it as the source of truth. Unresolved items are
reported to stderr.
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

import requests

GITHUB_RAW = "https://raw.githubusercontent.com/Adyen/adyen-web/v{version}/{path}"

# component -> { config interface name, source path within the adyen-web repo }
def _c(interface, folder):
    return {"config_interface": interface, "types_path": f"packages/lib/src/components/{folder}/types.ts"}


COMPONENTS = {
    "Card": _c("CardConfiguration", "Card"),
    "Dropin": _c("DropinConfiguration", "Dropin"),
    "ApplePay": _c("ApplePayConfiguration", "ApplePay"),
    "GooglePay": _c("GooglePayConfiguration", "GooglePay"),
    "PayPal": _c("PayPalConfiguration", "PayPal"),
    "PayPalFastlane": _c("FastlaneConfiguration", "PayPalFastlane"),
    "AmazonPay": _c("AmazonPayConfiguration", "AmazonPay"),
    "CashAppPay": _c("CashAppPayConfiguration", "CashAppPay"),
    "Ach": _c("AchConfiguration", "Ach"),
    "Sepa": _c("SepaConfiguration", "Sepa"),
    "PayTo": _c("PayToConfiguration", "PayTo"),
    "PreAuthorizedDebitCanada": _c("PreAuthorizedDebitCanadaConfiguration", "PreAuthorizedDebitCanada"),
    "Giftcard": _c("GiftCardConfiguration", "Giftcard"),
    "UPI": _c("UPIConfiguration", "UPI"),
    "ANCV": _c("ANCVConfiguration", "ANCV"),
    "Econtext": _c("EcontextConfiguration", "Econtext"),
    "Dragonpay": _c("DragonpayConfiguraton", "Dragonpay"),  # note: typo exists in adyen-web source
    "Redirect": _c("RedirectConfiguration", "Redirect"),
    "Boleto": _c("BoletoConfiguration", "Boleto"),
    "Pix": _c("PixConfiguration", "Pix"),
}


def fetch_source(version, path):
    url = GITHUB_RAW.format(version=version, path=path)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def extract_interface_body(source, interface_name):
    """Return (body_without_outer_braces, extends_clause) or (None, None)."""
    m = re.search(
        r'interface\s+' + re.escape(interface_name) + r'\b([^{]*)\{',
        source,
    )
    if not m:
        return None, None
    extends_clause = m.group(1).strip()
    start = m.end()
    depth = 1
    i = start
    while i < len(source) and depth > 0:
        c = source[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        i += 1
    return source[start:i - 1], extends_clause


def split_members(body):
    """Split an interface body into (jsdoc_block_or_None, member_text) pairs.

    Tracks (), {}, [], <> nesting so union/object/function types stay intact,
    and treats '=>' as a token so arrow-function return types don't unbalance
    the '<>' counter.
    """
    members = []
    pending_jsdoc = None
    stmt = []
    depth = 0
    i = 0
    n = len(body)
    while i < n:
        # block comment (JSDoc)
        if body.startswith('/*', i):
            end = body.find('*/', i)
            if end == -1:
                break
            block = body[i:end + 2]
            if ''.join(stmt).strip() == '':
                pending_jsdoc = block
            i = end + 2
            continue
        # line comment
        if body.startswith('//', i):
            eol = body.find('\n', i)
            i = n if eol == -1 else eol
            continue
        # arrow token
        if body[i] == '=' and i + 1 < n and body[i + 1] == '>':
            stmt.append('=>')
            i += 2
            continue
        c = body[i]
        if c in '({[<':
            depth += 1
            stmt.append(c)
        elif c in ')}]>':
            depth = max(0, depth - 1)
            stmt.append(c)
        elif c == ';' and depth == 0:
            text = ''.join(stmt).strip()
            if text:
                members.append((pending_jsdoc, text))
            pending_jsdoc = None
            stmt = []
        else:
            stmt.append(c)
        i += 1
    tail = ''.join(stmt).strip()
    if tail:
        members.append((pending_jsdoc, tail))
    return members


def parse_jsdoc(block):
    info = {"internal": False, "merchant": False, "default_raw": None, "description": ""}
    if not block:
        return info
    lines = []
    for line in block.splitlines():
        line = line.strip()
        line = re.sub(r'^/\*\*?', '', line)
        line = re.sub(r'\*/\s*$', '', line)
        line = re.sub(r'^\*', '', line).strip()
        lines.append(line)
    text = '\n'.join(lines)
    info["internal"] = '@internal' in text
    info["merchant"] = (
        'merchant set config option' in text
        or 'overwritten by merchant' in text
        or 'merchant config option' in text
    )
    dm = re.search(r'@defaultValue\s+(.+)', text)
    if dm:
        info["default_raw"] = dm.group(1).strip()
    desc = [ln for ln in lines if ln and not ln.startswith('@') and not ln.startswith('-')]
    info["description"] = desc[0] if desc else ''
    return info


def parse_member_signature(text):
    """'name?: type' -> (name, type_str) or None (skips index signatures)."""
    text = text.strip()
    if text.startswith('['):  # index signature e.g. [key: string]: T
        return None
    m = re.match(r'^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:\s*(.+)$', text, re.S)
    if not m:
        return None
    name = m.group(1)
    type_str = re.sub(r'\s+', ' ', m.group(2).strip())
    return name, type_str


def parse_enum(type_str):
    parts = [p.strip() for p in type_str.split('|')]
    if len(parts) < 2:
        return None
    values = []
    for p in parts:
        m = re.fullmatch(r"""['"](.*)['"]""", p)
        if not m:
            return None
        values.append(m.group(1))
    return values


def parse_imports(source):
    """Map imported identifier -> module path (relative imports only)."""
    result = {}
    for m in re.finditer(r'import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+[\'"]([^\'"]+)[\'"]', source):
        path = m.group(2)
        for raw in m.group(1).split(','):
            name = raw.strip()
            am = re.match(r'\w+\s+as\s+(\w+)', name)
            if am:
                name = am.group(1)
            if name:
                result[name] = path
    return result


def _find_alias_union(ident, text):
    m = re.search(r'\btype\s+' + re.escape(ident) + r'\s*=\s*([^;]+);', text)
    if not m:
        return None
    return parse_enum(re.sub(r'\s+', ' ', m.group(1).strip()))


def make_alias_resolver(version, base_path, source, import_map, cache):
    """Resolve a bare type identifier to a string-literal union (one import hop)."""
    def resolve(ident):
        vals = _find_alias_union(ident, source)
        if vals:
            return vals
        mod = import_map.get(ident)
        if not mod or not mod.startswith('.'):
            return None
        base_dir = os.path.dirname(base_path)
        joined = os.path.normpath(os.path.join(base_dir, mod))
        for candidate in (joined + '.ts', joined + '/index.ts'):
            if candidate not in cache:
                try:
                    cache[candidate] = fetch_source(version, candidate)
                except requests.HTTPError:
                    cache[candidate] = None
            mod_src = cache[candidate]
            if mod_src:
                vals = _find_alias_union(ident, mod_src)
                if vals:
                    return vals
        return None
    return resolve


def coerce_default(raw, type_str):
    """Return (has_default, value) where value is JSON-serializable, or (False, None)."""
    if raw is None:
        return False, None
    r = raw.strip().strip('`').strip()
    if r in ('true', 'false'):
        return True, (r == 'true')
    if re.fullmatch(r'-?\d+', r):
        return True, int(r)
    if re.fullmatch(r'-?\d+\.\d+', r):
        return True, float(r)
    qm = re.fullmatch(r"""['"](.*)['"]""", r)
    if qm:
        return True, qm.group(1)
    # bare single token treated as a string when the type is string-ish
    if re.fullmatch(r'[A-Za-z0-9_]+', r) and ("'" in type_str or 'string' in type_str):
        return True, r
    return False, None


def control_for(type_str, enum, is_function):
    if is_function:
        return "function"
    if enum:
        return "enum"
    t = type_str.strip()
    if t == 'boolean':
        return "boolean"
    if t == 'string':
        return "string"
    if t == 'number':
        return "number"
    if t.endswith('[]') or t.startswith('Array<'):
        return "array"
    return "object"


def build_prop(jsdoc_block, member_text, resolve_alias=None):
    sig = parse_member_signature(member_text)
    if not sig:
        return None
    name, type_str = sig
    doc = parse_jsdoc(jsdoc_block)

    is_function = '=>' in type_str or type_str.startswith('(')
    enum = parse_enum(type_str)
    if enum is None and resolve_alias and re.fullmatch(r'[A-Za-z_$][\w$]*', type_str):
        enum = resolve_alias(type_str)
    has_default, default = coerce_default(doc["default_raw"], type_str)
    if is_function:
        has_default, default = False, None

    if doc["merchant"]:
        category = "merchant"
    elif doc["internal"]:
        category = "internal"
    else:
        category = "merchant"

    return {
        "name": name,
        "type": type_str,
        "control": control_for(type_str, enum, is_function),
        "enumValues": enum,
        "category": category,
        "isFunction": is_function,
        "hasDefault": has_default,
        "default": default,
        "defaultRaw": doc["default_raw"],
        "description": doc["description"],
    }


# Base interfaces to note but NOT merge (generic element plumbing, mostly @internal
# props + checkout-level callbacks that aren't component-specific config).
STOP_AT = {"UIElementProps", "BaseElementProps"}


def fetch_cached(version, path, cache):
    if path not in cache:
        try:
            cache[path] = fetch_source(version, path)
        except requests.HTTPError:
            cache[path] = None
    return cache[path]


def resolve_candidates(current_path, module):
    base_dir = os.path.dirname(current_path)
    joined = os.path.normpath(os.path.join(base_dir, module))
    return [joined + '.ts', joined + '/index.ts', joined + '.tsx']


def split_top_level_commas(s):
    parts, cur, depth = [], [], 0
    for c in s:
        if c in '<([{':
            depth += 1
        elif c in '>)]}':
            depth = max(0, depth - 1)
        if c == ',' and depth == 0:
            parts.append(''.join(cur))
            cur = []
        else:
            cur.append(c)
    if ''.join(cur).strip():
        parts.append(''.join(cur))
    return parts


def parse_extends_bases(extends_clause):
    if not extends_clause:
        return []
    ec = re.sub(r'^\s*extends\s+', '', extends_clause.strip())
    if not ec:
        return []
    bases = []
    for part in split_top_level_commas(ec):
        m = re.match(r'([A-Za-z_$][\w$]*)', part.strip())
        if m:
            bases.append(m.group(1))
    return bases


def _file_for_interface(name, current_path, current_src, import_map, version, cache):
    """Return the path of the file defining `interface name`, following one import."""
    if re.search(r'interface\s+' + re.escape(name) + r'\b', current_src):
        return current_path
    module = import_map.get(name)
    if not module or not module.startswith('.'):
        return None
    for candidate in resolve_candidates(current_path, module):
        src = fetch_cached(version, candidate, cache)
        if src and re.search(r'interface\s+' + re.escape(name) + r'\b', src):
            return candidate
    return None


def collect_interface_props(version, path, interface_name, cache, seen, report):
    """Recursively collect props from an interface and its (mergeable) base interfaces."""
    if (path, interface_name) in seen:
        return []
    seen.add((path, interface_name))

    src = fetch_cached(version, path, cache)
    if src is None:
        report.append(f"    could not fetch {path}")
        return []

    body, extends_clause = extract_interface_body(src, interface_name)
    if body is None:
        report.append(f"    interface {interface_name} not found in {path}")
        return []

    import_map = parse_imports(src)
    resolve_alias = make_alias_resolver(version, path, src, import_map, cache)

    props = []
    for jsdoc_block, member_text in split_members(body):
        prop = build_prop(jsdoc_block, member_text, resolve_alias)
        if prop:
            props.append(prop)

    for base in parse_extends_bases(extends_clause):
        if base in STOP_AT:
            continue
        base_path = _file_for_interface(base, path, src, import_map, version, cache)
        if base_path:
            props += collect_interface_props(version, base_path, base, cache, seen, report)
        else:
            report.append(f"    unresolved base interface: {base}")
    return props


def generate_component(version, name, cfg, report, cache):
    source = fetch_source(version, cfg["types_path"])
    body, extends_clause = extract_interface_body(source, cfg["config_interface"])
    if body is None:
        report.append(f"{name}: interface {cfg['config_interface']} not found in {cfg['types_path']}")
        return None

    props = collect_interface_props(version, cfg["types_path"], cfg["config_interface"], cache, set(), report)

    # dedupe by name (a subclass prop shadows the inherited one; first wins)
    seen_names, deduped = set(), []
    for p in props:
        if p["name"] in seen_names:
            continue
        seen_names.add(p["name"])
        deduped.append(p)
    deduped.sort(key=lambda p: p["name"].lower())

    merchant = sum(1 for p in deduped if p["category"] == "merchant")
    with_default = sum(1 for p in deduped if p["hasDefault"])
    report.append(
        f"{name}: {len(deduped)} props ({merchant} merchant, {with_default} with defaults); "
        f"extends: {extends_clause or '(none)'}"
    )
    return {
        "configInterface": cfg["config_interface"],
        "sourcePath": cfg["types_path"],
        "extends": extends_clause,
        "props": deduped,
    }


def main():
    ap = argparse.ArgumentParser(description="Generate Adyen Web component config catalog")
    ap.add_argument("--version", default="6.36.0", help="adyen-web version (maps to git tag v<version>)")
    ap.add_argument("--component", help="only generate this component (default: all registered)")
    args = ap.parse_args()

    names = [args.component] if args.component else list(COMPONENTS)
    unknown = [n for n in names if n not in COMPONENTS]
    if unknown:
        sys.exit(f"Unknown component(s): {', '.join(unknown)}. Known: {', '.join(COMPONENTS)}")

    report = []
    components = {}
    cache = {}
    for name in names:
        try:
            result = generate_component(args.version, name, COMPONENTS[name], report, cache)
            if result:
                components[name] = result
        except requests.HTTPError as e:
            report.append(f"{name}: fetch failed - {e}")

    catalog = {
        "version": args.version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "note": "Best-effort extraction from adyen-web TypeScript source. Review before relying on it.",
        "components": components,
    }

    out_dir = os.path.join(os.path.dirname(__file__), "..", "app", "config_catalog")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{args.version}.json")
    with open(out_path, "w") as f:
        json.dump(catalog, f, indent=2)

    print(f"Wrote {out_path}")
    print("\n--- report ---", file=sys.stderr)
    for line in report:
        print(line, file=sys.stderr)


if __name__ == "__main__":
    main()
