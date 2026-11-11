// Каталог магазина. Чтобы добавить предмет — добавьте объект в массив.
// slot: skin | glasses | hat | backpack | watch | badge
// Для скинов: body (кофта), pants, shoes, hair, skinTone, shape, extra.
// Для аксессуаров: model — id построителя из player/CharacterModel.js, color/color2 — цвета.

export const CATEGORIES = [
  { id: 'skin', name: 'Образы', icon: '👕' },
  { id: 'hat', name: 'Шапки', icon: '🧢' },
  { id: 'glasses', name: 'Очки', icon: '👓' },
  { id: 'backpack', name: 'Рюкзаки', icon: '🎒' },
  { id: 'watch', name: 'Часы', icon: '⌚' },
  { id: 'badge', name: 'Значки', icon: '📛' },
];

export const ITEMS = [
  // ---------- Образы ----------
  { id: 'skin_uniform', slot: 'skin', name: 'Школьная форма', icon: '👔', price: 0, desc: 'Классика: синий пиджак и брюки.',
    body: '#3557c9', pants: '#2b2f4a', shoes: '#222', hair: '#5b3a1e', skinTone: '#ffd3b0', shape: 'normal', extra: 'tie' },
  { id: 'skin_sport', slot: 'skin', name: 'Спортсмен', icon: '🏃', price: 60, desc: 'Красный спортивный костюм с полосками.',
    body: '#e84545', pants: '#e84545', shoes: '#fff', hair: '#2d1b0e', skinTone: '#f5c8a0', shape: 'normal', extra: 'stripes' },
  { id: 'skin_green', slot: 'skin', name: 'Эко‑герой', icon: '🌿', price: 80, desc: 'Зелёная толстовка и любовь к природе.',
    body: '#2ecc71', pants: '#2d6a4f', shoes: '#6b4f2a', hair: '#e8b04a', skinTone: '#ffe0c4', shape: 'normal', extra: 'leaf' },
  { id: 'skin_round', slot: 'skin', name: 'Пончик', icon: '🍩', price: 120, desc: 'Круглый и очень добрый.',
    body: '#ff9ff3', pants: '#a55eea', shoes: '#fff', hair: '#ff6b81', skinTone: '#ffe0c4', shape: 'round' },
  { id: 'skin_tall', slot: 'skin', name: 'Баскетболист', icon: '🏀', price: 130, desc: 'Высокий рост и оранжевая майка.',
    body: '#ff8c1a', pants: '#1e272e', shoes: '#ff3f34', hair: '#111', skinTone: '#a86b45', shape: 'tall', extra: 'number' },
  { id: 'skin_wizard', slot: 'skin', name: 'Волшебник', icon: '🧙', price: 150, desc: 'Мантия со звёздами. Знания — это магия!',
    body: '#6c5ce7', pants: '#4834d4', shoes: '#2d1b69', hair: '#dfe6e9', skinTone: '#ffd3b0', shape: 'normal', extra: 'robe' },
  { id: 'skin_hero', slot: 'skin', name: 'Супергерой', icon: '🦸', price: 180, desc: 'С плащом! Летать нельзя, но очень хочется.',
    body: '#0984e3', pants: '#d63031', shoes: '#d63031', hair: '#2d3436', skinTone: '#ffd3b0', shape: 'normal', extra: 'cape' },
  { id: 'skin_astro', slot: 'skin', name: 'Космонавт', icon: '👩‍🚀', price: 200, desc: 'Скафандр для покорения звёзд знаний.',
    body: '#f5f6fa', pants: '#dcdde1', shoes: '#718093', hair: '#6d4c41', skinTone: '#ffe0c4', shape: 'normal', extra: 'astro' },
  { id: 'skin_dino', slot: 'skin', name: 'Динозаврик', icon: '🦖', price: 220, desc: 'Костюм динозавра с хвостом и шипами.',
    body: '#44bd32', pants: '#44bd32', shoes: '#2f7d22', hair: '#44bd32', skinTone: '#ffd3b0', shape: 'normal', extra: 'dino' },
  { id: 'skin_robot', slot: 'skin', name: 'Робот', icon: '🤖', price: 250, desc: 'Бип-буп! Квадратная голова и антенна.',
    body: '#95a5a6', pants: '#7f8c8d', shoes: '#34495e', hair: '#95a5a6', skinTone: '#bdc3c7', shape: 'robot' },
  { id: 'skin_mini', slot: 'skin', name: 'Малыш', icon: '🐣', price: 90, desc: 'Маленький, но очень умный.',
    body: '#feca57', pants: '#48dbfb', shoes: '#ff6b6b', hair: '#ff9f43', skinTone: '#ffe0c4', shape: 'mini' },

  // ---------- Шапки ----------
  { id: 'hat_cap', slot: 'hat', name: 'Кепка', icon: '🧢', price: 40, model: 'cap', color: '#e74c3c', desc: 'Козырьком вперёд!' },
  { id: 'hat_beanie', slot: 'hat', name: 'Шапка с помпоном', icon: '🧶', price: 35, model: 'beanie', color: '#0abde3', color2: '#fff', desc: 'Тёплая и смешная.' },
  { id: 'hat_propeller', slot: 'hat', name: 'Пропеллер', icon: '🚁', price: 110, model: 'propeller', color: '#f1c40f', color2: '#e74c3c', desc: 'Вращается, когда ты бежишь!' },
  { id: 'hat_wizard', slot: 'hat', name: 'Колпак мага', icon: '🎩', price: 90, model: 'wizard', color: '#5f27cd', color2: '#feca57', desc: 'Со звездой на макушке.' },
  { id: 'hat_crown', slot: 'hat', name: 'Корона отличника', icon: '👑', price: 300, model: 'crown', color: '#f9ca24', desc: 'Только для настоящих знатоков.' },
  { id: 'hat_phones', slot: 'hat', name: 'Наушники', icon: '🎧', price: 75, model: 'headphones', color: '#2d3436', color2: '#ff7675', desc: 'Для любителей музыки.' },

  // ---------- Очки ----------
  { id: 'gl_round', slot: 'glasses', name: 'Круглые очки', icon: '👓', price: 30, model: 'round', color: '#2d3436', desc: 'Очень умный вид.' },
  { id: 'gl_sun', slot: 'glasses', name: 'Солнечные очки', icon: '🕶️', price: 45, model: 'sun', color: '#111', desc: 'Круто!' },
  { id: 'gl_3d', slot: 'glasses', name: '3D‑очки', icon: '🥽', price: 60, model: 'threeD', color: '#fff', desc: 'Красно-синие, как в кино.' },
  { id: 'gl_star', slot: 'glasses', name: 'Звёздные очки', icon: '🤩', price: 85, model: 'star', color: '#ff9ff3', desc: 'Для звёзд класса.' },

  // ---------- Рюкзаки ----------
  { id: 'bp_classic', slot: 'backpack', name: 'Обычный рюкзак', icon: '🎒', price: 0, model: 'classic', color: '#e17055', color2: '#fdcb6e', desc: 'Надёжный школьный рюкзак.' },
  { id: 'bp_star', slot: 'backpack', name: 'Звёздный рюкзак', icon: '⭐', price: 70, model: 'star', color: '#341f97', color2: '#feca57', desc: 'Со светящейся звездой.' },
  { id: 'bp_teddy', slot: 'backpack', name: 'Рюкзак‑мишка', icon: '🧸', price: 90, model: 'teddy', color: '#b07d4f', color2: '#e8c39e', desc: 'Мягкий друг за спиной.' },
  { id: 'bp_rocket', slot: 'backpack', name: 'Реактивный ранец', icon: '🚀', price: 140, model: 'rocket', color: '#dfe6e9', color2: '#ff7675', desc: 'Пламя при прыжке!' },

  // ---------- Часы ----------
  { id: 'w_simple', slot: 'watch', name: 'Наручные часы', icon: '⌚', price: 25, model: 'simple', color: '#2d3436', desc: 'Чтобы не опаздывать.' },
  { id: 'w_smart', slot: 'watch', name: 'Смарт‑часы', icon: '📱', price: 80, model: 'smart', color: '#00cec9', desc: 'Светятся голубым.' },
  { id: 'w_gold', slot: 'watch', name: 'Золотые часы', icon: '🏅', price: 160, model: 'simple', color: '#f9ca24', desc: 'Блестят на солнце.' },

  // ---------- Значки ----------
  { id: 'b_star', slot: 'badge', name: 'Значок‑звезда', icon: '🌟', price: 20, model: 'star', color: '#feca57', desc: 'Маленькая звезда на груди.' },
  { id: 'b_abc', slot: 'badge', name: 'Значок «АБВ»', icon: '🔤', price: 35, model: 'round', color: '#ff6b6b', desc: 'Любитель букв.' },
  { id: 'b_heart', slot: 'badge', name: 'Сердечко', icon: '💖', price: 30, model: 'heart', color: '#ff4d6d', desc: 'Доброе сердце.' },
  { id: 'b_medal', slot: 'badge', name: 'Золотая медаль', icon: '🥇', price: 120, model: 'medal', color: '#f9ca24', desc: 'За отличную учёбу.' },
];

export const PAJAMAS = { id: 'pajamas', slot: 'skin', body: '#a29bfe', pants: '#a29bfe', shoes: '#dfe6e9', hair: '#5b3a1e', skinTone: '#ffd3b0', shape: 'normal', extra: 'dots' };

export const itemById = (id) => ITEMS.find((i) => i.id === id);

// Внешний вид по сохранению. override позволяет, например, надеть пижаму.
export function lookFromEquipped(equipped, { skinOverride = null, noBackpack = false } = {}) {
  const skinBase = itemById(equipped.skin) || ITEMS[0];
  const skin = skinOverride ? { ...skinOverride, hair: skinBase.hair, skinTone: skinBase.skinTone, shape: skinBase.shape === 'robot' ? 'normal' : skinBase.shape } : skinBase;
  const acc = {};
  for (const slot of ['glasses', 'hat', 'backpack', 'watch', 'badge']) {
    if (slot === 'backpack' && noBackpack) continue;
    const it = equipped[slot] && itemById(equipped[slot]);
    if (it) acc[slot] = it;
  }
  return { skin, acc };
}
