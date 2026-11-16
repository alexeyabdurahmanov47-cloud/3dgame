import './ui/styles.css';
import { Assets } from './core/Assets.js';

// Точка входа: сначала загружаем модели из Blender (public/models), потом запускаем игру
const ui = document.getElementById('ui');
ui.innerHTML = '<div class="loading"><div class="books">📚</div><div class="title">READ&amp;PRACTICE</div><div class="bar"><div id="boot-bar"></div></div><div class="tip">Загружаем 3D-модели…</div></div>';
Assets.load((p) => { const b = document.getElementById('boot-bar'); if (b) b.style.width = Math.round(p * 100) + '%'; })
  .then(async () => {
    ui.innerHTML = '';
    const { Game } = await import('./core/Game.js');
    window.game = new Game();
  })
  .catch((e) => {
    console.error(e);
    ui.innerHTML = '<div class="loading"><div class="title">Не удалось загрузить 3D-модели</div><div class="tip">Обнови страницу.</div></div>';
  });
