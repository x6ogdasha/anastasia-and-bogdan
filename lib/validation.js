export const allowedDrinks = [
  'no_preference',
  'sparkling',
  'white_wine',
  'red_wine',
  'spirits',
  'non_alcoholic',
];

const allowedKeys = new Set(['name', 'attendance', 'song', 'drinks']);

export function validateRsvp(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { _form: 'Ожидался JSON-объект.' } };
  }

  const extraKey = Object.keys(input).find((key) => !allowedKeys.has(key));
  if (extraKey) errors._form = `Неизвестное поле: ${extraKey}.`;

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) errors.name = 'Пожалуйста, укажите ваше имя.';
  else if (name.length > 120) errors.name = 'Имя должно быть короче 120 символов.';

  const attendance = input.attendance;
  if (attendance !== 'yes' && attendance !== 'no') {
    errors.attendance = 'Выберите, сможете ли вы присутствовать.';
  }

  const song = input.song === undefined ? '' : input.song;
  if (typeof song !== 'string') errors.song = 'Трек должен быть строкой.';
  else if (song.length > 200) errors.song = 'Название трека должно быть короче 200 символов.';

  const drinks = input.drinks;
  if (!Array.isArray(drinks)) {
    errors.drinks = 'Напитки должны быть переданы списком.';
  } else if (new Set(drinks).size !== drinks.length) {
    errors.drinks = 'Варианты напитков не должны повторяться.';
  } else if (!drinks.every((drink) => typeof drink === 'string' && allowedDrinks.includes(drink))) {
    errors.drinks = 'Выбран неизвестный вариант напитка.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      attendance,
      song: song.trim(),
      drinks,
    },
  };
}
