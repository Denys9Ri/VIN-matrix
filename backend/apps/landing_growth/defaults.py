from copy import deepcopy


DEFAULT_LANDING_CONFIG = {
    'seo': {
        'title': 'VIN-matrix — CRM для СТО, шиномонтажу та автозапчастин',
        'description': (
            'VIN-matrix — система управління автобізнесом: дошка візитів, CRM клієнтів, '
            'склад, закупки, документи, оплати, Нова пошта та аналітика.'
        ),
    },
    'hero': {
        'eyebrow': 'СИСТЕМА УПРАВЛІННЯ ДЛЯ АВТОБІЗНЕСУ',
        'title': 'Менше хаосу.',
        'accent': 'Більше контролю.',
        'lead': (
            'VIN-matrix збирає візити, клієнтів, склад, оплату, документи й команду '
            'в один робочий простір. Ти бачиш процес — а не шукаєш його по чатах.'
        ),
        'primary_cta': 'Почати безкоштовно',
        'secondary_cta': 'Подивитись демо',
        'note': '14 днів повного доступу · без очікування запрошення',
    },
    'tariff': {
        'heading': 'Один тариф. Усе основне для щоденної роботи.',
        'lead': (
            'Створи акаунт, налаштуй свій бізнес і почни тестувати процес '
            'без очікування демо-доступу.'
        ),
        'cta': 'Створити акаунт',
    },
    'final_cta': {
        'heading': 'Створи свій робочий простір. Без запиту доступу.',
        'lead': 'Після реєстрації проходиш коротке налаштування і заходиш у власний VIN-matrix.',
        'cta': 'Реєстрація',
    },
}

ALLOWED_FIELD_RULES = {
    'hero.eyebrow': {'min': 12, 'max': 90, 'risk': 'low', 'metric': 'hero_demo_click'},
    'hero.title': {'min': 8, 'max': 55, 'risk': 'medium', 'metric': 'hero_register_click'},
    'hero.accent': {'min': 8, 'max': 55, 'risk': 'medium', 'metric': 'hero_register_click'},
    'hero.lead': {'min': 55, 'max': 260, 'risk': 'medium', 'metric': 'hero_register_click'},
    'hero.primary_cta': {'min': 5, 'max': 42, 'risk': 'low', 'metric': 'hero_register_click'},
    'hero.secondary_cta': {'min': 5, 'max': 52, 'risk': 'low', 'metric': 'hero_demo_click'},
    'hero.note': {'min': 12, 'max': 100, 'risk': 'low', 'metric': 'hero_register_click'},
    'tariff.heading': {'min': 20, 'max': 110, 'risk': 'medium', 'metric': 'pricing_register_click'},
    'tariff.lead': {'min': 35, 'max': 220, 'risk': 'medium', 'metric': 'pricing_register_click'},
    'tariff.cta': {'min': 5, 'max': 42, 'risk': 'low', 'metric': 'pricing_register_click'},
    'final_cta.heading': {'min': 20, 'max': 110, 'risk': 'medium', 'metric': 'final_register_click'},
    'final_cta.lead': {'min': 30, 'max': 220, 'risk': 'medium', 'metric': 'final_register_click'},
    'final_cta.cta': {'min': 5, 'max': 42, 'risk': 'low', 'metric': 'final_register_click'},
    'seo.title': {'min': 35, 'max': 67, 'risk': 'medium', 'metric': 'search_ctr', 'seo': True},
    'seo.description': {'min': 100, 'max': 170, 'risk': 'medium', 'metric': 'search_ctr', 'seo': True},
}

PUBLIC_EVENT_NAMES = {
    'landing_view',
    'hero_register_click',
    'hero_demo_click',
    'demo_interaction',
    'features_view',
    'pricing_view',
    'pricing_register_click',
    'final_register_click',
    'solution_click',
    'faq_open',
    'login_click',
    'register_start',
}

CONVERSION_EVENT_BY_METRIC = {
    'hero_register_click': 'hero_register_click',
    'hero_demo_click': 'hero_demo_click',
    'pricing_register_click': 'pricing_register_click',
    'final_register_click': 'final_register_click',
    'register_start': 'register_start',
    'register_complete': 'register_complete',
}

BLOCK_BY_FIELD = {
    path: path.split('.', 1)[0]
    for path in ALLOWED_FIELD_RULES
}


def default_landing_config():
    return deepcopy(DEFAULT_LANDING_CONFIG)
