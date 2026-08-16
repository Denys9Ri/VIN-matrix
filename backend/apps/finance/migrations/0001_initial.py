from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0009_supplier_accounts'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LegalEntity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entity_type', models.CharField(choices=[('fop', 'ФОП'), ('tov', 'ТОВ'), ('other', 'Інша юрособа')], default='fop', max_length=20)),
                ('name', models.CharField(max_length=255)),
                ('tax_id', models.CharField(blank=True, default='', max_length=32)),
                ('registration_code', models.CharField(blank=True, default='', max_length=32)),
                ('iban', models.CharField(blank=True, default='', max_length=64)),
                ('bank_name', models.CharField(blank=True, default='', max_length=255)),
                ('requisites', models.TextField(blank=True, default='')),
                ('is_primary', models.BooleanField(default=False)),
                ('is_default_for_parts', models.BooleanField(default=False)),
                ('is_default_for_services', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_legal_entities', to='core.company')),
            ],
            options={'ordering': ['sort_order', '-is_primary', 'name', 'id']},
        ),
        migrations.CreateModel(
            name='FinanceAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('account_type', models.CharField(choices=[('cash', 'Готівка / каса'), ('bank', 'Банківський рахунок'), ('card', 'Картка'), ('terminal', 'Термінал'), ('other', 'Інше')], default='cash', max_length=20)),
                ('currency', models.CharField(default='UAH', max_length=8)),
                ('iban', models.CharField(blank=True, default='', max_length=64)),
                ('bank_name', models.CharField(blank=True, default='', max_length=255)),
                ('opening_balance', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('is_primary', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_accounts', to='core.company')),
                ('legal_entity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accounts', to='finance.legalentity')),
            ],
            options={'ordering': ['sort_order', '-is_primary', 'name', 'id']},
        ),
        migrations.CreateModel(
            name='VisitFinanceAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_visit_assignments', to='core.company')),
                ('parts_legal_entity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='parts_visit_assignments', to='finance.legalentity')),
                ('services_legal_entity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='services_visit_assignments', to='finance.legalentity')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_finance_visit_assignments', to=settings.AUTH_USER_MODEL)),
                ('visit', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='finance_assignment', to='core.visit')),
            ],
            options={'ordering': ['-updated_at', '-id']},
        ),
        migrations.CreateModel(
            name='FinanceTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('income', 'Надходження'), ('expense', 'Витрата'), ('transfer', 'Переказ')], max_length=20)),
                ('source_type', models.CharField(choices=[('manual', 'Ручна операція'), ('salary', 'Виплата зарплати'), ('supplier', 'Оплата постачальнику'), ('refund', 'Повернення'), ('owner', 'Внесення / вилучення власника'), ('tax', 'Податки'), ('adjustment', 'Коригування'), ('other', 'Інше')], default='manual', max_length=30)),
                ('occurred_at', models.DateTimeField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('category', models.CharField(blank=True, default='other', max_length=80)),
                ('title', models.CharField(max_length=255)),
                ('counterparty', models.CharField(blank=True, default='', max_length=255)),
                ('payment_method', models.CharField(blank=True, default='', max_length=40)),
                ('comment', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='finance.financeaccount')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_transactions', to='core.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_finance_transactions', to=settings.AUTH_USER_MODEL)),
                ('employee', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='finance_payouts', to='core.employee')),
                ('legal_entity', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='finance.legalentity')),
                ('supplier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='finance_payments', to='core.supplier')),
                ('target_account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='incoming_transfers', to='finance.financeaccount')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_finance_transactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-occurred_at', '-id']},
        ),
        migrations.CreateModel(
            name='FinanceSourceAllocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_type', models.CharField(choices=[('visit_payment', 'Оплата замовлення'), ('expense', 'Витрата СТО')], max_length=30)),
                ('source_id', models.BigIntegerField()),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('account', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_allocations', to='finance.financeaccount')),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_source_allocations', to='core.company')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_finance_source_allocations', to=settings.AUTH_USER_MODEL)),
                ('legal_entity', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='source_allocations', to='finance.legalentity')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_finance_source_allocations', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['source_type', 'source_id', 'id']},
        ),
        migrations.CreateModel(
            name='FinanceChangeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('object_type', models.CharField(max_length=50)),
                ('object_id', models.CharField(max_length=80)),
                ('action', models.CharField(choices=[('create', 'Створено'), ('update', 'Змінено'), ('delete', 'Видалено / деактивовано')], max_length=20)),
                ('before', models.JSONField(blank=True, default=dict)),
                ('after', models.JSONField(blank=True, default=dict)),
                ('reason', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='finance_changes', to=settings.AUTH_USER_MODEL)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_change_log', to='core.company')),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.AddConstraint(
            model_name='legalentity',
            constraint=models.UniqueConstraint(fields=('company', 'name'), name='finance_entity_company_name_uniq'),
        ),
        migrations.AddIndex(
            model_name='legalentity',
            index=models.Index(fields=['company', 'is_active', 'sort_order'], name='finance_entity_active_idx'),
        ),
        migrations.AddIndex(
            model_name='legalentity',
            index=models.Index(fields=['company', 'is_primary'], name='finance_entity_primary_idx'),
        ),
        migrations.AddConstraint(
            model_name='financeaccount',
            constraint=models.UniqueConstraint(fields=('company', 'legal_entity', 'name'), name='finance_account_scope_name_uniq'),
        ),
        migrations.AddIndex(
            model_name='financeaccount',
            index=models.Index(fields=['company', 'is_active', 'account_type'], name='finance_account_active_idx'),
        ),
        migrations.AddIndex(
            model_name='financeaccount',
            index=models.Index(fields=['legal_entity', 'is_active'], name='finance_account_entity_idx'),
        ),
        migrations.AddIndex(
            model_name='visitfinanceassignment',
            index=models.Index(fields=['company', 'updated_at'], name='finance_visit_assign_idx'),
        ),
        migrations.AddIndex(
            model_name='financetransaction',
            index=models.Index(fields=['company', 'occurred_at'], name='finance_tx_company_date_idx'),
        ),
        migrations.AddIndex(
            model_name='financetransaction',
            index=models.Index(fields=['company', 'kind', 'occurred_at'], name='finance_tx_kind_date_idx'),
        ),
        migrations.AddIndex(
            model_name='financetransaction',
            index=models.Index(fields=['company', 'legal_entity', 'occurred_at'], name='finance_tx_entity_date_idx'),
        ),
        migrations.AddIndex(
            model_name='financetransaction',
            index=models.Index(fields=['company', 'account', 'occurred_at'], name='finance_tx_account_date_idx'),
        ),
        migrations.AddIndex(
            model_name='financetransaction',
            index=models.Index(fields=['company', 'source_type', 'occurred_at'], name='finance_tx_source_date_idx'),
        ),
        migrations.AddIndex(
            model_name='financesourceallocation',
            index=models.Index(fields=['company', 'source_type', 'source_id'], name='finance_source_lookup_idx'),
        ),
        migrations.AddIndex(
            model_name='financesourceallocation',
            index=models.Index(fields=['company', 'legal_entity'], name='finance_source_entity_idx'),
        ),
        migrations.AddIndex(
            model_name='financesourceallocation',
            index=models.Index(fields=['company', 'account'], name='finance_source_account_idx'),
        ),
        migrations.AddIndex(
            model_name='financechangelog',
            index=models.Index(fields=['company', 'created_at'], name='finance_change_company_idx'),
        ),
        migrations.AddIndex(
            model_name='financechangelog',
            index=models.Index(fields=['company', 'object_type', 'object_id'], name='finance_change_object_idx'),
        ),
    ]
