import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, CheckCircle2, ClipboardCheck, FileText, Gauge, Save } from 'lucide-react';
import api from '../../api/axios';

const fuelOptions = ['Порожній', '1/4', '1/2', '3/4', 'Повний'];
const statusClass = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  attention: 'bg-amber-50 text