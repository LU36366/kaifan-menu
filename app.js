const get = id => document.getElementById(id);
const make = (tag, value, className) => {
  const element = document.createElement(tag);
  if (value) element.textContent = value;
  if (className) element.className = className;
  return element;
};
const categories = ['全部','早点','素菜','荤菜','饮品'];
const key = 'kaifan-web-cart';
let category = categories[0];
let dishes = [];
let cart = {};
try { cart = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
const quantity = id => Number.isInteger(cart[id]) && cart[id] > 0 ? cart[id] : 0;
const normalize = value => value.toLowerCase().replaceAll('番茄','西红柿');
let statusTimer;
function showStatus(message) {
  get('status').textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { get('status').textContent = ''; }, 3000);
}
function button(label, action, style) {
  const control = make('button', label, style);
  control.type = 'button';
  control.onclick = action;
  return control;
}
function render() {
  const query = normalize(get('search').value.trim());
  const menu = dishes.filter(d => (category === '全部' || d.category === category) && normalize(d.name + d.ingredients.join(' ')).includes(query));
  get('filters').replaceChildren(...categories.map(item => {
    const tab = button(item, () => { category = item; render(); });
    tab.setAttribute('aria-pressed', item === category);
    return tab;
  }));
  get('menu').replaceChildren(...menu.map(dish => {
    const card = make('article', '', 'card');
    const cover = button('', () => openRecipe(dish), 'cover');
    cover.setAttribute('aria-label', dish.name + '菜谱');
    const image = make('img');
    image.src = '.' + dish.image;
    image.alt = '';
    image.loading = 'lazy';
    cover.append(image);
    const body = make('div', '', 'body');
    const stepper = make('div', '', 'stepper');
    const qty = quantity(dish.id);
    for (const delta of [-1, 1]) {
      if (delta < 0 && !qty) continue;
      const adjust = button(delta < 0 ? '−' : '+', () => {
        cart[dish.id] = Math.max(0, Math.min(20, qty + delta));
        try { localStorage.setItem(key, JSON.stringify(cart)); } catch {}
        render();
        document.getElementById(adjust.id)?.focus();
      }, delta < 0 ? 'outline' : '');
      adjust.id = dish.id + (delta < 0 ? '-minus' : '-plus');
      adjust.setAttribute('aria-label', (delta < 0 ? '减少' : '增加') + dish.name + '一份');
      if (delta > 0 && qty) stepper.append(make('span', String(qty)));
      stepper.append(adjust);
    }
    body.append(make('div', dish.name, 'title'), make('p', dish.flavor + ' · ' + dish.minutes + ' 分钟', 'flavor'), stepper);
    card.append(cover, body);
    return card;
  }));
  get('empty').hidden = menu.length > 0;
  const total = dishes.reduce((sum, dish) => sum + quantity(dish.id), 0);
  get('count').textContent = total;
  get('checkout').disabled = !total;
}
function openRecipe(dish) {
  const dialog = get('recipe');
  const heading = make('div', '', 'row');
  heading.append(make('h2', dish.name), button('关闭', () => dialog.close(), 'outline'));
  const image = make('img');
  image.src = '.' + dish.image;
  image.alt = dish.name + ' AI 配图';
  const ingredients = make('ul');
  ingredients.append(...dish.ingredients.map(value => make('li', value)));
  const steps = make('ol');
  steps.append(...dish.steps.map(value => make('li', value)));
  dialog.replaceChildren(heading, image, make('p', 'AI 配图 · ' + (dish.serving || '约 2 人份'), 'hint'), make('h3','备料'), ingredients, make('h3','做法'), steps);
  if (dish.note) dialog.append(make('p', dish.note, 'hint'));
  if (dish.source) {
    const link = make('a', '查看小红书原帖');
    link.href = dish.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    dialog.append(link);
  }
  dialog.showModal();
}
const selected = () => dishes.filter(d => quantity(d.id)).map(d => d.name + ' × ' + quantity(d.id));
get('search').oninput = render;
get('checkout').onclick = () => {
  get('chosen').replaceChildren(...selected().map(value => make('li', value)));
  get('copyFallback').hidden = true;
  get('order').showModal();
};
document.querySelector('.close').onclick = () => get('order').close();
get('orderForm').onsubmit = async event => {
  event.preventDefault();
  const name = get('name').value.trim();
  if (!name) { get('name').focus(); showStatus('请填写称呼'); return; }
  const note = get('note').value.trim();
  const order = ['开饭 · 点菜单', '称呼：' + name, ...selected(), ...(note ? ['备注：' + note] : [])].join('\n');
  const fallback = get('copyFallback');
  fallback.value = order;
  fallback.hidden = false;
  try {
    await navigator.clipboard.writeText(order);
    fallback.hidden = true;
    showStatus('已复制，请粘贴到微信发给掌勺人');
  } catch {
    fallback.focus();
    fallback.select();
    if (document.execCommand('copy')) showStatus('已复制，请粘贴到微信发给掌勺人');
    else showStatus('请长按下面的订单内容复制');
  }
};
get('share').onclick = async () => {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({title:'开饭 · 家常菜单',url});
    else { await navigator.clipboard.writeText(url); showStatus('菜单链接已复制'); }
  } catch (error) {
    if (error.name !== 'AbortError') window.prompt('复制菜单链接',url);
  }
};
fetch('menu.json').then(response => {
  if (!response.ok) throw new Error('Menu unavailable');
  return response.json();
}).then(data => { dishes = data; render(); }).catch(() => {
  get('empty').hidden = false;
  get('empty').textContent = '菜单加载失败，请刷新重试。';
});
