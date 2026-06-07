DEFAULT_COMPANY_OPTIONS = [
    # Магазин: статуси замовлень
    {'mode': 'store', 'group': 'store_order_status', 'key': 'NEW', 'label': 'Нове', 'color': 'blue', 'icon': 'sparkles', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'new', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'PROCESSING', 'label': 'В обробці', 'color': 'amber', 'icon': 'clock', 'sort_order': 20, 'is_system': True, 'semantic_role': 'in_progress', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'WAITING', 'label': 'Очікує товар', 'color': 'blue', 'icon': 'truck', 'sort_order': 30, 'is_system': True, 'semantic_role': 'waiting', 'metadata': {'show_on_board': False, 'final': False, 'merged_into': 'PROCESSING'}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'READY', 'label': 'Готове', 'color': 'indigo', 'icon': 'check-circle', 'sort_order': 40, 'is_system': True, 'semantic_role': 'ready', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'SHIPPED', 'label': 'Відправлено', 'color': 'emerald', 'icon': 'send', 'sort_order': 50, 'is_system': True, 'semantic_role': 'shipped', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'DONE', 'label': 'Виконано', 'color': 'emerald', 'icon': 'badge-check', 'sort_order': 60, 'is_system': True, 'semantic_role': 'done', 'metadata': {'show_on_board': True, 'final': True}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'CANCELLED', 'label': 'Скасовано', 'color': 'rose', 'icon': 'x-circle', 'sort_order': 90, 'is_system': True, 'semantic_role': 'cancelled', 'metadata': {'show_on_board': False, 'final': True}},
    {'mode': 'store', 'group': 'store_order_status', 'key': 'RETURNED', 'label': 'Повернення', 'color': 'orange', 'icon': 'rotate-ccw', 'sort_order': 100, 'is_system': True, 'semantic_role': 'returned', 'metadata': {'show_on_board': False, 'final': True}},

    # СТО: статуси візитів
    {'mode': 'sto', 'group': 'sto_visit_status', 'key': 'SELECTION', 'label': 'В черзі / підбір', 'color': 'amber', 'icon': 'clock', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'new', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'sto', 'group': 'sto_visit_status', 'key': 'ORDERED', 'label': 'В роботі', 'color': 'blue', 'icon': 'wrench', 'sort_order': 20, 'is_system': True, 'semantic_role': 'in_progress', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'sto', 'group': 'sto_visit_status', 'key': 'WAITING_PARTS', 'label': 'Чекаємо запчастини', 'color': 'orange', 'icon': 'package-search', 'sort_order': 30, 'is_system': True, 'semantic_role': 'waiting', 'metadata': {'show_on_board': False, 'final': False, 'merged_into': 'ORDERED'}},
    {'mode': 'sto', 'group': 'sto_visit_status', 'key': 'DONE', 'label': 'Готово', 'color': 'emerald', 'icon': 'check-circle', 'sort_order': 40, 'is_system': True, 'semantic_role': 'ready', 'metadata': {'show_on_board': True, 'final': False}},
    {'mode': 'sto', 'group': 'sto_visit_status', 'key': 'ISSUED', 'label': 'Видано', 'color': 'emerald', 'icon': 'badge-check', 'sort_order': 50, 'is_system': True, 'semantic_role': 'done', 'metadata': {'show_on_board': False, 'final': True}},
    {'mode': 'sto', 'group': 'sto_visit_status', 'key': 'CANCELLED', 'label': 'Скасовано', 'color': 'rose', 'icon': 'x-circle', 'sort_order': 90, 'is_system': True, 'semantic_role': 'cancelled', 'metadata': {'show_on_board': False, 'final': True}},

    # Запчастини / товари
    {'mode': 'both', 'group': 'part_status', 'key': 'WAITING', 'label': 'Очікує', 'color': 'amber', 'icon': 'clock', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'waiting'},
    {'mode': 'both', 'group': 'part_status', 'key': 'ORDERED', 'label': 'Замовлено', 'color': 'blue', 'icon': 'shopping-cart', 'sort_order': 20, 'is_system': True, 'semantic_role': 'ordered'},
    {'mode': 'both', 'group': 'part_status', 'key': 'ARRIVED', 'label': 'Приїхало', 'color': 'emerald', 'icon': 'package-check', 'sort_order': 30, 'is_system': True, 'semantic_role': 'ready'},
    {'mode': 'both', 'group': 'part_status', 'key': 'INSTALLED', 'label': 'Встановлено', 'color': 'emerald', 'icon': 'wrench', 'sort_order': 40, 'is_system': True, 'semantic_role': 'done'},
    {'mode': 'both', 'group': 'part_status', 'key': 'RETURNED', 'label': 'Повернено', 'color': 'orange', 'icon': 'rotate-ccw', 'sort_order': 80, 'is_system': True, 'semantic_role': 'returned'},
    {'mode': 'both', 'group': 'part_status', 'key': 'DEFECTIVE', 'label': 'Брак', 'color': 'rose', 'icon': 'alert-triangle', 'sort_order': 85, 'is_system': True, 'semantic_role': 'defective'},
    {'mode': 'both', 'group': 'part_status', 'key': 'UNAVAILABLE', 'label': 'Немає в наявності', 'color': 'slate', 'icon': 'ban', 'sort_order': 90, 'is_system': True, 'semantic_role': 'cancelled'},

    # Типи оплат
    {'mode': 'both', 'group': 'payment_type', 'key': 'cash', 'label': 'Готівка', 'color': 'emerald', 'icon': 'banknote', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'cash', 'metadata': {'is_cash': True}},
    {'mode': 'both', 'group': 'payment_type', 'key': 'card', 'label': 'Картка', 'color': 'blue', 'icon': 'credit-card', 'sort_order': 20, 'is_system': True, 'semantic_role': 'bank', 'metadata': {'is_bank': True}},
    {'mode': 'both', 'group': 'payment_type', 'key': 'fop', 'label': 'Переказ на ФОП', 'color': 'indigo', 'icon': 'landmark', 'sort_order': 30, 'is_system': True, 'semantic_role': 'bank', 'metadata': {'is_bank': True}},
    {'mode': 'both', 'group': 'payment_type', 'key': 'personal_card', 'label': 'Переказ на карту', 'color': 'purple', 'icon': 'smartphone', 'sort_order': 40, 'is_system': True, 'semantic_role': 'bank'},
    {'mode': 'both', 'group': 'payment_type', 'key': 'terminal', 'label': 'Термінал', 'color': 'cyan', 'icon': 'contactless', 'sort_order': 50, 'is_system': True, 'semantic_role': 'bank'},
    {'mode': 'store', 'group': 'payment_type', 'key': 'cod', 'label': 'Післяплата', 'color': 'amber', 'icon': 'truck', 'sort_order': 60, 'is_system': True, 'semantic_role': 'postpay'},
    {'mode': 'both', 'group': 'payment_type', 'key': 'mixed', 'label': 'Змішана оплата', 'color': 'slate', 'icon': 'split', 'sort_order': 90, 'is_system': True, 'semantic_role': 'mixed'},

    # Джерела
    {'mode': 'both', 'group': 'order_source', 'key': 'phone', 'label': 'Телефон', 'color': 'blue', 'icon': 'phone', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'direct'},
    {'mode': 'store', 'group': 'order_source', 'key': 'market', 'label': 'Авторинок', 'color': 'amber', 'icon': 'store', 'sort_order': 20, 'is_system': True, 'semantic_role': 'offline'},
    {'mode': 'store', 'group': 'order_source', 'key': 'prom', 'label': 'Prom.ua', 'color': 'purple', 'icon': 'shopping-bag', 'sort_order': 30, 'is_system': True, 'semantic_role': 'marketplace'},
    {'mode': 'store', 'group': 'order_source', 'key': 'rozetka', 'label': 'Rozetka', 'color': 'green', 'icon': 'shopping-bag', 'sort_order': 40, 'is_system': True, 'semantic_role': 'marketplace'},
    {'mode': 'both', 'group': 'order_source', 'key': 'instagram', 'label': 'Instagram', 'color': 'pink', 'icon': 'instagram', 'sort_order': 50, 'is_system': True, 'semantic_role': 'social'},
    {'mode': 'both', 'group': 'order_source', 'key': 'telegram', 'label': 'Telegram', 'color': 'sky', 'icon': 'send', 'sort_order': 60, 'is_system': True, 'semantic_role': 'messenger'},
    {'mode': 'both', 'group': 'order_source', 'key': 'regular_client', 'label': 'Постійний клієнт', 'color': 'emerald', 'icon': 'user-check', 'sort_order': 70, 'is_system': True, 'semantic_role': 'repeat'},
    {'mode': 'both', 'group': 'order_source', 'key': 'recommendation', 'label': 'Рекомендація', 'color': 'indigo', 'icon': 'users', 'sort_order': 80, 'is_system': True, 'semantic_role': 'referral'},

    # Причини скасування / відмови
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'expensive', 'label': 'Дорого', 'color': 'rose', 'icon': 'wallet', 'sort_order': 10, 'is_system': True, 'semantic_role': 'price'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'no_answer', 'label': 'Не дозвонились', 'color': 'slate', 'icon': 'phone-off', 'sort_order': 20, 'is_system': True, 'semantic_role': 'no_contact'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'changed_mind', 'label': 'Клієнт передумав', 'color': 'amber', 'icon': 'rotate-ccw', 'sort_order': 30, 'is_system': True, 'semantic_role': 'client'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'found_cheaper', 'label': 'Знайшов дешевше', 'color': 'orange', 'icon': 'search', 'sort_order': 40, 'is_system': True, 'semantic_role': 'competitor'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'not_available', 'label': 'Немає товару', 'color': 'rose', 'icon': 'package-x', 'sort_order': 50, 'is_system': True, 'semantic_role': 'stock'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'too_long', 'label': 'Довго чекати', 'color': 'amber', 'icon': 'clock', 'sort_order': 60, 'is_system': True, 'semantic_role': 'delay'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'selection_error', 'label': 'Помилка підбору', 'color': 'rose', 'icon': 'alert-triangle', 'sort_order': 70, 'is_system': True, 'semantic_role': 'mistake'},
    {'mode': 'both', 'group': 'cancel_reason', 'key': 'other', 'label': 'Інше', 'color': 'slate', 'icon': 'more-horizontal', 'sort_order': 999, 'is_system': True, 'semantic_role': 'other'},

    # Статуси клієнтів
    {'mode': 'both', 'group': 'client_status', 'key': 'new', 'label': 'Новий', 'color': 'blue', 'icon': 'user-plus', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'new'},
    {'mode': 'both', 'group': 'client_status', 'key': 'active', 'label': 'Активний', 'color': 'emerald', 'icon': 'user-check', 'sort_order': 20, 'is_system': True, 'semantic_role': 'active'},
    {'mode': 'both', 'group': 'client_status', 'key': 'regular', 'label': 'Постійний', 'color': 'indigo', 'icon': 'repeat', 'sort_order': 30, 'is_system': True, 'semantic_role': 'regular'},
    {'mode': 'both', 'group': 'client_status', 'key': 'sleeping', 'label': 'Сплячий', 'color': 'slate', 'icon': 'moon', 'sort_order': 40, 'is_system': True, 'semantic_role': 'sleeping'},
    {'mode': 'both', 'group': 'client_status', 'key': 'problem', 'label': 'Проблемний', 'color': 'rose', 'icon': 'alert-triangle', 'sort_order': 50, 'is_system': True, 'semantic_role': 'problem'},
    {'mode': 'both', 'group': 'client_status', 'key': 'vip', 'label': 'VIP', 'color': 'amber', 'icon': 'crown', 'sort_order': 60, 'is_system': True, 'semantic_role': 'vip'},

    # Категорії товарів як довідник. Стара таблиця Category залишається окремо, щоб нічого не ламати.
    {'mode': 'both', 'group': 'product_category', 'key': 'filters', 'label': 'Фільтри', 'color': 'blue', 'icon': 'filter', 'sort_order': 10, 'is_system': True, 'is_default': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'brakes', 'label': 'Гальмівна система', 'color': 'rose', 'icon': 'disc', 'sort_order': 20, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'suspension', 'label': 'Підвіска', 'color': 'amber', 'icon': 'car', 'sort_order': 30, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'steering', 'label': 'Рульове керування', 'color': 'indigo', 'icon': 'disc-3', 'sort_order': 35, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'engine', 'label': 'Двигун', 'color': 'orange', 'icon': 'settings', 'sort_order': 40, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'timing', 'label': 'ГРМ та ремені', 'color': 'orange', 'icon': 'rotate-cw', 'sort_order': 45, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'cooling', 'label': 'Охолодження', 'color': 'cyan', 'icon': 'fan', 'sort_order': 50, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'fuel', 'label': 'Паливна система', 'color': 'amber', 'icon': 'fuel', 'sort_order': 55, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'ignition', 'label': 'Запалювання', 'color': 'yellow', 'icon': 'zap', 'sort_order': 60, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'transmission', 'label': 'Трансмісія / зчеплення', 'color': 'purple', 'icon': 'cog', 'sort_order': 65, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'exhaust', 'label': 'Вихлопна система', 'color': 'slate', 'icon': 'wind', 'sort_order': 70, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'electrics', 'label': 'Електрика та датчики', 'color': 'blue', 'icon': 'cable', 'sort_order': 75, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'lighting', 'label': 'Світло та оптика', 'color': 'yellow', 'icon': 'lightbulb', 'sort_order': 80, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'body', 'label': 'Кузовні деталі', 'color': 'slate', 'icon': 'car-front', 'sort_order': 85, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'climate', 'label': 'Кондиціонер / клімат', 'color': 'sky', 'icon': 'snowflake', 'sort_order': 90, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'bearings', 'label': 'Підшипники та ступиці', 'color': 'indigo', 'icon': 'circle-dot', 'sort_order': 95, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'oils', 'label': 'Мастила та рідини', 'color': 'emerald', 'icon': 'droplets', 'sort_order': 100, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'chemistry', 'label': 'Автохімія', 'color': 'emerald', 'icon': 'flask-conical', 'sort_order': 105, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'wipers', 'label': 'Двірники та омивачі', 'color': 'cyan', 'icon': 'waves', 'sort_order': 110, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'tires', 'label': 'Шини та диски', 'color': 'slate', 'icon': 'circle', 'sort_order': 115, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'battery', 'label': 'Акумулятори', 'color': 'green', 'icon': 'battery-charging', 'sort_order': 120, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'tools', 'label': 'Інструменти', 'color': 'slate', 'icon': 'wrench', 'sort_order': 125, 'is_system': True, 'semantic_role': 'category'},
    {'mode': 'both', 'group': 'product_category', 'key': 'accessories', 'label': 'Аксесуари', 'color': 'pink', 'icon': 'sparkles', 'sort_order': 130, 'is_system': True, 'semantic_role': 'category'},
]


def sync_product_categories(company):
    from .models import Category, CompanyOption
    if not company:
        return 0
    created = 0
    options = CompanyOption.objects.filter(company=company, group='product_category', is_active=True).order_by('sort_order', 'id')
    existing = {str(item.name or '').strip().lower(): item for item in Category.objects.filter(company=company)}
    for option in options:
        name = str(option.label or '').strip()
        if not name:
            continue
        key = name.lower()
        if key in existing:
            continue
        Category.objects.create(company=company, name=name)
        existing[key] = True
        created += 1
    return created


def seed_company_options(company, force=False):
    from .models import CompanyOption
    if not company:
        return {'created': 0, 'updated': 0, 'categories_synced': 0}
    created_count = 0
    updated_count = 0
    for item in DEFAULT_COMPANY_OPTIONS:
        if item['mode'] not in ('both', getattr(company, 'business_type', 'sto')):
            continue
        defaults = item.copy()
        mode = defaults.pop('mode')
        group = defaults.pop('group')
        key = defaults.pop('key')
        obj, created = CompanyOption.objects.get_or_create(company=company, group=group, key=key, defaults={**defaults, 'mode': mode})
        if created:
            created_count += 1
            continue
        # Не перетираємо ручні назви/кольори власника. Оновлюємо тільки службові системні поля при restore_defaults(force=True).
        if force and obj.is_system:
            for field in ['description', 'color', 'icon', 'sort_order', 'semantic_role', 'is_default']:
                if field in defaults:
                    setattr(obj, field, defaults[field])
            obj.mode = mode
            updated_count += 1
        # Keep legacy seeded waiting columns out of the main boards without touching user-edited labels/colors.
        if group in ('store_order_status', 'sto_visit_status') and defaults.get('semantic_role') == 'waiting':
            metadata = obj.metadata or {}
            if metadata.get('show_on_board') is not False:
                metadata['show_on_board'] = False
                metadata['merged_into'] = defaults.get('metadata', {}).get('merged_into')
                obj.metadata = metadata
                updated_count += 1
        if force and obj.is_system and 'metadata' in defaults:
            metadata = obj.metadata or {}
            metadata.update(defaults.get('metadata') or {})
            obj.metadata = metadata
        if updated_count:
            obj.save()
    return {'created': created_count, 'updated': updated_count, 'categories_synced': sync_product_categories(company)}
