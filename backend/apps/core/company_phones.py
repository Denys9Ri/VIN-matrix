import json


MAX_COMPANY_PHONES = 10


def _as_bool(value, default=True):
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() not in {'0', 'false', 'no', 'off', ''}


def _phone_key(number):
    digits = ''.join(character for character in number if character.isdigit())
    return digits or number.casefold()


def normalize_company_phones(value, fallback_phone=''):
    """Return the stable public shape used by settings and documents."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            value = []

    source = value if isinstance(value, list) else []
    normalized = []
    seen = set()

    for item in source:
        if isinstance(item, str):
            number = item.strip()
            show_in_documents = True
        elif isinstance(item, dict):
            number = str(item.get('number') or item.get('phone') or '').strip()
            show_in_documents = _as_bool(
                item.get('show_in_documents', item.get('showInDocuments')),
                default=True,
            )
        else:
            continue

        if not number:
            continue
        number = number[:50]
        key = _phone_key(number)
        if key in seen:
            continue
        seen.add(key)
        normalized.append({
            'number': number,
            'show_in_documents': show_in_documents,
        })
        if len(normalized) >= MAX_COMPANY_PHONES:
            break

    fallback = str(fallback_phone or '').strip()[:50]
    if not normalized and fallback:
        normalized.append({'number': fallback, 'show_in_documents': True})

    return normalized


def document_phone_numbers(company):
    phones = normalize_company_phones(
        getattr(company, 'phones', []),
        getattr(company, 'phone', ''),
    )
    return [item['number'] for item in phones if item['show_in_documents']]


def document_phone_text(company, separator=' · '):
    return separator.join(document_phone_numbers(company))
