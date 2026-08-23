from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_supplier_accounts'),
        ('finance', '0002_supplier_account_binding'),
    ]

    operations = [
        migrations.CreateModel(
            name='MechanicPayrollRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('salary_scheme', models.CharField(choices=[('services_only', 'Відсоток від робіт'), ('parts_only', 'Відсоток від маржі запчастин'), ('services_and_parts_profit', 'Відсоток від робіт + маржі запчастин'), ('order_profit', 'Відсоток від прибутку замовлення'), ('fixed', 'Фіксована сума')], default='services_only', max_length=40)),
                ('commission_percent', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('parts_commission_percent', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('fixed_salary_amount', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('payout_period', models.CharField(choices=[('daily', 'Щодня'), ('weekly', 'Щотижня'), ('monthly', 'Щомісяця'), ('custom', 'Довільний період')], default='monthly', max_length=20)),
                ('is_salary_active', models.BooleanField(default=True)),
                ('effective_from', models.DateTimeField()),
                ('effective_to', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='mechanic_payroll_rules', to='core.company')),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payroll_rules', to='core.employee')),
            ],
            options={
                'ordering': ['employee_id', '-effective_from', '-id'],
                'indexes': [
                    models.Index(fields=['company', 'effective_from'], name='finance_payroll_company_idx'),
                    models.Index(fields=['employee', 'effective_from'], name='finance_payroll_employee_idx'),
                ],
                'constraints': [
                    models.UniqueConstraint(condition=models.Q(('effective_to__isnull', True)), fields=('employee',), name='finance_payroll_one_active_rule'),
                ],
            },
        ),
    ]
