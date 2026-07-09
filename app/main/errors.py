import json
import logging


def handle_adyen_error(endpoint, error):
    """
    Log an Adyen SDK error and return a (body, status_code) tuple that a Flask
    route can return directly. This surfaces Adyen's own error payload
    (status, errorCode, message, pspReference) to the caller instead of a
    generic 500 stack trace, which is what a support agent needs to diagnose
    a failing integration.
    """
    logging.error(f"{endpoint} | Adyen API error: {error}")
    logging.error(error.debug())

    try:
        status_code = int(error.status_code)
    except (TypeError, ValueError):
        status_code = 502

    if error.raw_response:
        body = error.raw_response
    else:
        body = json.dumps({
            "status": status_code,
            "errorCode": error.error_code,
            "message": error.message or "Adyen API request failed",
        })

    return body, status_code
