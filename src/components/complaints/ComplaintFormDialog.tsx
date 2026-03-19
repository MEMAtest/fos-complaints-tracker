'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ComplaintPriority, ComplaintRecord, ComplaintStatus } from '@/lib/complaints/types';

const STATUS_OPTIONS: ComplaintStatus[] = ['open', 'investigating', 'escalated', 'referred_to_fos', 'resolved', 'closed'];
const PRIORITY_OPTIONS: ComplaintPriority[] = ['low', 'medium', 'high', 'urgent'];

interface ComplaintFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ComplaintRecord | null;
  onSaved: () => Promise<void>;
}

export function ComplaintFormDialog({ open, onOpenChange, record, onSaved }: ComplaintFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    complaintReference: '',
    complainantName: '',
    firmName: '',
    product: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    status: 'open' as ComplaintStatus,
    priority: 'medium' as ComplaintPriority,
    description: '',
    rootCause: '',
    assignedTo: '',
    fosReferred: false,
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        complaintReference: record.complaintReference,
        complainantName: record.complainantName,
        firmName: record.firmName,
        product: record.product || '',
        receivedDate: record.receivedDate,
        status: record.status,
        priority: record.priority,
        description: record.description || '',
        rootCause: record.rootCause || '',
        assignedTo: record.assignedTo || '',
        fosReferred: record.fosReferred,
        notes: record.notes || '',
      });
      return;
    }

    setForm({
      complaintReference: '',
      complainantName: '',
      firmName: '',
      product: '',
      receivedDate: new Date().toISOString().slice(0, 10),
      status: 'open',
      priority: 'medium',
      description: '',
      rootCause: '',
      assignedTo: '',
      fosReferred: false,
      notes: '',
    });
  }, [open, record]);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(record ? `/api/complaints/${record.id}` : '/api/complaints', {
        method: record ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save complaint.');
      }
      onOpenChange(false);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{record ? 'Edit Complaint' : 'Add Complaint'}</DialogTitle>
          <DialogDescription>
            Capture the operational complaint record that sits alongside the FOS intelligence dataset.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Complaint reference" value={form.complaintReference} onChange={(value) => setForm((current) => ({ ...current, complaintReference: value }))} />
          <Field label="Complainant name" value={form.complainantName} onChange={(value) => setForm((current) => ({ ...current, complainantName: value }))} />
          <Field label="Firm name" value={form.firmName} onChange={(value) => setForm((current) => ({ ...current, firmName: value }))} />
          <Field label="Product" value={form.product} onChange={(value) => setForm((current) => ({ ...current, product: value }))} />
          <Field type="date" label="Received date" value={form.receivedDate} onChange={(value) => setForm((current) => ({ ...current, receivedDate: value }))} />
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status</label>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ComplaintStatus }))}>
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Priority</label>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as ComplaintPriority }))}>
              {PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <Field label="Root cause" value={form.rootCause} onChange={(value) => setForm((current) => ({ ...current, rootCause: value }))} />
          <Field label="Assigned owner" value={form.assignedTo} onChange={(value) => setForm((current) => ({ ...current, assignedTo: value }))} />
          <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.fosReferred} onChange={(event) => setForm((current) => ({ ...current, fosReferred: event.target.checked }))} />
            Mark as referred to FOS
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Description</span>
            <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Initial note</span>
            <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving || !form.complaintReference || !form.complainantName || !form.receivedDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : record ? 'Save changes' : 'Create complaint'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
    </label>
  );
}
