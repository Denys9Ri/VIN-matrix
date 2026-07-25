import html
import re
from dataclasses import dataclass
from typing import Any

from .defaults import ALLOWED_FIELD_RULES


_HTML_RE = re.compile(r'<[^>]+>')
_URL_RE = re.compile(r'https?://|www\.', re.IGNORECASE)
_SPAM_RE = re.compile(
    r'(?i)(гарантован|№\s*1|номер\s*один|найкращ|революційн|100\s*%|'
    r'миттєвий\s+результат|без\s+ризику|обійти\s+google|зламати\s+google|'
    r'накрут|боти\s+для\s+кліків|прихований\s+текст)'
)
_PRICE_RE = re.compile(r'(?i)(\d[\d\s]{2,}\s*(грн|₴|usd|eur|€|\$)|ціна|тариф\s+\d)')
_CONTROL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
_ALLOWED_PUNCTUATION_RE = re.compile(r'^[\w\sА-Яа-яІіЇїЄєҐґ.,:;!?—–\-«»“”ʼ’()/%+&·]+$', re.UNICODE)


@dataclass(frozen=True)
class GuardResult:
    ok: bool
    normalized_value: str
    reason: str = ''
    risk_level: str = 'low'
    seo_change: bool = False


def _normalize(value: Any) -> str:
    text = html.unescape(str(value or ''))
    text = _CONTROL_RE.sub('', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _mostly_ukrainian_or_neutral(value: str) -> bool:
    letters = [char for char in value if char.isalpha()]
    if not letters:
        return False
    cyrillic = sum('\u0400' <= char <= '\u04ff' for char in letters)
    latin = sum(('a' <= char.lower() <= 'z') for char in letters)
    # Brand names and CRM/SaaS terminology are allowed, but Ukrainian text must dominate.
    return cyrillic >= max(4, latin)


def validate_candidate(field_path: str, proposed_value: Any, current_value: str = '') -> GuardResult:
    rule = ALLOWED_FIELD_RULES.get(field_path)
    if not rule:
        return GuardResult(False, '', 'Поле не входить до дозволеного реєстру.')

    value = _normalize(proposed_value)
    if not value:
        return GuardResult(False, '', 'Порожнє значення.')
    if value == _normalize(current_value):
        return GuardResult(False, value, 'Значення не відрізняється від поточного.')
    if _HTML_RE.search(value):
        return GuardResult(False, value, 'HTML у маркетинговому тексті заборонений.')
    if _URL_RE.search(value):
        return GuardResult(False, value, 'URL не можна додавати автоматично.')
    if not rule['min'] <= len(value) <= rule['max']:
        return GuardResult(
            False,
            value,
            f'Довжина має бути {rule["min"]}–{rule["max"]} символів.',
        )
    if _SPAM_RE.search(value):
        return GuardResult(False, value, 'Текст містить непідтверджену або маніпулятивну обіцянку.')
    if field_path not in {'seo.title', 'seo.description'} and _PRICE_RE.search(value):
        return GuardResult(False, value, 'Ціни та тарифні умови не змінюються автопілотом.')
    if not _mostly_ukrainian_or_neutral(value):
        return GuardResult(False, value, 'Текст має бути українською мовою.')
    if not _ALLOWED_PUNCTUATION_RE.match(value):
        return GuardResult(False, value, 'Текст містить недозволені символи.')
    if field_path == 'seo.title' and value.count('VIN-matrix') != 1:
        return GuardResult(False, value, 'SEO title має містити VIN-matrix рівно один раз.')
    if field_path == 'seo.description' and 'VIN-matrix' not in value:
        return GuardResult(False, value, 'SEO description має містити VIN-matrix.')

    return GuardResult(
        True,
        value,
        risk_level=rule.get('risk', 'low'),
        seo_change=bool(rule.get('seo')),
    )


def sanitize_metadata(raw: Any) -> dict:
    if not isinstance(raw, dict):
        return {}
    allowed = {
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'referrer_host',
        'viewport',
        'target',
        'source',
        'device',
    }
    result = {}
    for key in allowed:
        if key not in raw:
            continue
        value = _normalize(raw[key])[:200]
        if value:
            result[key] = value
    return result
