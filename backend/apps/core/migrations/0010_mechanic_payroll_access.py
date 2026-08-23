from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_supplier_accounts'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='can_manage_inventory',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='employee',
            name='can_take_payments',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='employee',
            name='can_view_analytics',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='employee',
            name='can_view_clients',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='employee',
            name='fixed_salary_amount',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
        migrations.AddField(
            model_name='employee',
            name='payout_month_day',
            field=models.CharField(default='5', max_length=8),
        ),
        migrations.AddField(
            model_name='employee',
            name='payout_weekday',
            field=models.PositiveSmallIntegerField(default=4),
        ),
        migrations.AddField(
            model_name='employee',
            name='salary_effective_from',
            field=models.DateField(default=django.utils.timezone.localdate),
        ),
        migrations.AlterField(
            model_name='employee',
            name='salary_scheme',
            field=models.CharField(choices=[('services_only', 'Відсоток тільки від робіт'), ('parts_profit_only', 'Відсоток тільки від маржі запчастин'), ('services_and_parts_profit', 'Відсоток від робіт + маржі запчастин'), ('order_profit', 'Відсоток від прибутку замовлення'), ('fixed', 'Фіксована сума')], default='services_only', max_length=40),
        ),
        migrations.AlterField(
            model_name='orderservice',
            name='commission_base',
            field=models.CharField(choices=[('services_only', 'Тільки роботи'), ('parts_profit_only', 'Тільки маржа запчастин'), ('services_and_parts_profit', 'Роботи + маржа запчастин'), ('order_profit', 'Прибуток замовлення'), ('fixed', 'Періодична фіксована сума')], default='services_only', max_length=40),
        ),
    ]
