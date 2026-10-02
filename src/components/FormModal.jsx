import { useEffect, useId, useRef, useState } from 'react';
import { fill } from '../utils/text.js';
import Modal from './Modal.jsx';
import { ErrorIcon } from './icons.jsx';
import { submitForm, errorMessage, HONEYPOT_FIELD } from '../integrations/submit.js';
import { setPrefill } from '../integrations/calendly.js';
import { track } from '../integrations/analytics.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FIELD_ORDER = ['name', 'email', 'phone', 'degree', 'status'];
const EMPTY = { name: '', email: '', phone: '', degree: '', status: '', message: '' };

function validate(values, ui) {
  const e = ui.form.errors;
  const f = ui.form.fields;
  const errors = {};
  const name = values.name.trim();
  if (!name) errors.name = fill(e.required, { field: f.name });
  else if (name.length < 2) errors.name = e.name;
  const email = values.email.trim();
  if (!email) errors.email = fill(e.required, { field: f.email });
  else if (!EMAIL_RE.test(email)) errors.email = e.email;
  const phone = values.phone.trim();
  if (!phone) errors.phone = fill(e.required, { field: f.phone });
  else {
    const digits = phone.replace(/[\s\-().]/g, '').replace(/^\+/, '');
    if (!/^(91|0)?\d{10}$/.test(digits)) errors.phone = e.phone;
  }
  if (!values.degree) errors.degree = fill(e.required, { field: f.degree });
  if (!values.status) errors.status = fill(e.required, { field: f.status });
  return errors;
}

// Application form. Personal data lives only in this component's state: never stored, never logged.
function ApplicationForm({ onClose, onSuccess, content }) {
  const { form, ui } = content;
  const f = ui.form;
  const uid = useId();
  const formRef = useRef(null);
  const submitRef = useRef(null);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null); // null | failure kind (see submit.js)
  const openedAt = useRef(0);
  const honeypotRef = useRef(null);
  const busyRef = useRef(false);
  useEffect(() => { openedAt.current = Date.now(); track('form_open'); }, []);
  const [lockWidth, setLockWidth] = useState(null);
  const summaryRef = useRef(null);

  const id = (k) => `${uid}-${k}`;
  const set = (k) => (e) => {
    const v = e.target.value;
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if (submitted) setErrors(validate(next, ui));
      return next;
    });
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || busyRef.current) return;
    setSubmitError(null);
    const errs = validate(values, ui);
    setSubmitted(true);
    setErrors(errs);
    const firstBad = FIELD_ORDER.find((k) => errs[k]);
    if (firstBad) {
      // focus the first invalid field after the error markup renders
      requestAnimationFrame(() => formRef.current?.querySelector(`#${CSS.escape(id(firstBad))}`)?.focus());
      return;
    }
    busyRef.current = true;
    setLockWidth(submitRef.current?.offsetWidth || null);
    setLoading(true);
    const result = await submitForm(values, form, {
      honeypot: honeypotRef.current?.value || '', elapsedMs: Date.now() - openedAt.current
    });
    busyRef.current = false;
    setLoading(false);
    if (result.ok) {
      if (!result.bot) track('form_submit', { success: true });
      // In-memory hand-off for Calendly prefill, only when booking.prefill === true
      setPrefill(content.booking?.prefill === true && !result.bot ? values : null);
      setValues(EMPTY);
      onSuccess();
    } else {
      track('form_submit', { success: false, reason: result.kind });
      setSubmitError(result.kind);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  const errorKeys = FIELD_ORDER.filter((k) => errors[k]);
  const field = (k, label, control, { optional = false } = {}) => (
    <div className={`field${errors[k] ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id(k)}>
        {label} <span className="field__req">{optional ? f.optional : f.required}</span>
      </label>
      {control}
      {errors[k] && (
        <p className="field__error" id={id(`${k}-err`)}><ErrorIcon width={16} height={16} /> <span>{errors[k]}</span></p>
      )}
    </div>
  );
  const common = (k, extra = {}) => ({
    id: id(k), name: k, value: values[k], onChange: set(k), readOnly: loading,
    'aria-required': k !== 'message' ? true : undefined,
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? id(`${k}-err`) : undefined,
    ...extra
  });

  return (
    <>
      <form className="form" ref={formRef} onSubmit={onSubmit} noValidate aria-busy={loading || undefined}>
        <h2 id="form-title" className="modal__title">{form.title}</h2>
        <p className="modal__subtitle">{form.subtitle}</p>

        {(errorKeys.length > 0 || submitError) && (
          <div className="form__summary" role="alert" tabIndex={-1} ref={summaryRef}>
            <ErrorIcon width={20} height={20} />
            <div>
              {submitError ? <p>{errorMessage(submitError, f)}</p> : (
                <>
                  <p>{f.errorSummary}</p>
                  <ul>
                    {errorKeys.map((k) => (
                      <li key={k}>
                        <a href={`#${id(k)}`} onClick={(e) => { e.preventDefault(); formRef.current.querySelector(`#${CSS.escape(id(k))}`)?.focus(); }}>{errors[k]}</a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {field('name', f.fields.name, <input className="input" type="text" autoComplete="name" {...common('name')} />)}
        {field('email', f.fields.email, <input className="input" type="email" inputMode="email" autoComplete="email" {...common('email')} />)}
        {field('phone', f.fields.phone, <input className="input" type="tel" inputMode="tel" autoComplete="tel" {...common('phone')} />)}
        {field('degree', f.fields.degree, (
          <select className="input select" {...common('degree', { readOnly: undefined, disabled: loading })}>
            <option value="">{f.selectPlaceholder}</option>
            {form.degreeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {field('status', f.fields.status, (
          <select className="input select" {...common('status', { readOnly: undefined, disabled: loading })}>
            <option value="">{f.selectPlaceholder}</option>
            {form.statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {field('message', f.fields.message, (
          <textarea className="input textarea" rows={3} maxLength={1000} placeholder={f.messagePlaceholder} {...common('message')} />
        ), { optional: true })}

        {/* Honeypot: hidden from people and assistive tech; bots tend to fill it */}
        <div className="hp-field" aria-hidden="true">
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" ref={honeypotRef} />
        </div>

        <div className="form__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>{form.cancelLabel}</button>
          <button type="submit" ref={submitRef} className={`btn btn--primary${loading ? ' btn--loading' : ''}`} aria-busy={loading || undefined}
            style={lockWidth && loading ? { minWidth: lockWidth } : undefined} disabled={loading}>
            {loading ? (<><span className="btn__spinner" aria-hidden="true" /><span className="visually-hidden">{f.submitting}</span></>) : form.submitLabel}
          </button>
        </div>
        <p className="form__trust">{form.trustLine}</p>
      </form>
    </>
  );
}

// The form is a child of Modal, so it only mounts while the dialog is open: every open starts empty.
export default function FormModal({ open, onClose, onSuccess, content }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="form-title" closeLabel={content.ui.close} variant="form" initialFocus="input">
      <ApplicationForm onClose={onClose} onSuccess={onSuccess} content={content} />
    </Modal>
  );
}
