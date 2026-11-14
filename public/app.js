const form = document.querySelector('#rsvpForm');
const submitButton = document.querySelector('#submitButton');
const successStatus = document.querySelector('#successStatus');
const toast = document.querySelector('#toast');
const drinkOptions = document.querySelector('#drinkOptions');
const formStartedAt = Date.now();
let isSubmitting = false;
let toastTimer;

const allowedDrinks = new Set([
  'no_preference',
  'sparkling',
  'white_wine',
  'red_wine',
  'spirits',
  'non_alcoholic',
]);

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function getSubmissionId() {
  const storageKey = 'wedding-rsvp-submission-id';
  let id = window.sessionStorage.getItem(storageKey);
  if (!id) {
    id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(storageKey, id);
  }
  return id;
}

function getPayload() {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    attendance: String(data.get('attendance') || ''),
    song: String(data.get('song') || '').trim(),
    drinks: data.getAll('drink').map(String),
  };
}

function validate(payload) {
  const errors = {};
  if (!payload.name) errors.name = 'Пожалуйста, укажите ваше имя.';
  else if (payload.name.length > 120) errors.name = 'Имя должно быть короче 120 символов.';

  if (!['yes', 'no'].includes(payload.attendance)) {
    errors.attendance = 'Пожалуйста, выберите один из вариантов.';
  }

  if (payload.song.length > 200) errors.song = 'Название трека должно быть короче 200 символов.';
  if (!payload.drinks.every((drink) => allowedDrinks.has(drink))) {
    errors.drinks = 'Выбран неизвестный вариант напитка.';
  }
  if (new Set(payload.drinks).size !== payload.drinks.length) {
    errors.drinks = 'Один вариант напитка выбран несколько раз.';
  }
  return errors;
}

function clearErrors() {
  form.querySelectorAll('[data-error-for]').forEach((node) => { node.textContent = ''; });
  form.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute('aria-invalid'));
}

function renderErrors(errors) {
  clearErrors();
  Object.entries(errors).forEach(([field, message]) => {
    const errorNode = form.querySelector(`[data-error-for="${field}"]`);
    if (errorNode) errorNode.textContent = message;

    const input = field === 'drinks'
      ? drinkOptions
      : form.elements.namedItem(field);
    input?.setAttribute?.('aria-invalid', 'true');
  });

  const firstInvalid = form.querySelector('[aria-invalid="true"]');
  firstInvalid?.focus?.();
}

function setLoading(loading) {
  isSubmitting = loading;
  submitButton.disabled = loading;
  submitButton.textContent = loading ? 'Отправляем…' : 'Отправить';
  form.setAttribute('aria-busy', String(loading));
}

drinkOptions.addEventListener('change', (event) => {
  if (!(event.target instanceof HTMLInputElement) || !event.target.checked) return;
  const options = [...drinkOptions.querySelectorAll('input[type="checkbox"]')];
  if (event.target.value === 'no_preference') {
    options.forEach((option) => { if (option !== event.target) option.checked = false; });
  } else {
    const noPreference = options.find((option) => option.value === 'no_preference');
    if (noPreference) noPreference.checked = false;
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSubmitting) return;

  const payload = getPayload();
  const errors = validate(payload);
  if (Object.keys(errors).length) {
    renderErrors(errors);
    showToast('Проверьте, пожалуйста, заполненные поля.');
    return;
  }

  clearErrors();
  setLoading(true);

  try {
    const response = await fetch('/api/rsvp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': getSubmissionId(),
        'X-Form-Started-At': String(formStartedAt),
        'X-Wedding-Website': String(form.elements.namedItem('website')?.value || ''),
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ ok: false }));
    if (!response.ok || !result.ok) {
      if (result.errors && typeof result.errors === 'object') renderErrors(result.errors);
      throw new Error(result.message || 'Не удалось сохранить ответ. Попробуйте ещё раз.');
    }

    form.hidden = true;
    successStatus.classList.add('is-visible');
    showToast('Спасибо! Ваш ответ сохранён.');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Произошла ошибка. Попробуйте ещё раз.');
    setLoading(false);
  }
});
