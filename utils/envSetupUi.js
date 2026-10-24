/**
 * UI for the ".env" section of the localhost config page.
 * - renderEnvSection(): server-rendered skeleton. The section is expanded when the bot is NOT logged in
 *   and collapsed (with a "Hiện .env" button) when it is. Secrets are never put in the HTML:
 *   the client only fetches them from /api/config/env after the section is opened.
 * - renderEnvScript(): inline client script (built with DOM APIs, no innerHTML, so values cannot inject markup).
 *
 * NOTE: the client script lives in String.raw, so it must not contain backticks or ${...}.
 */
const { ENV_SCHEMA } = require("./envSetup");

const escapeHtml = (value) =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const safeJson = (value) =>
	JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");

const renderEnvSection = ({ loggedIn = false, botName = "" } = {}) => `
<section id="envSection" class="glass-panel rounded-2xl mb-6" data-logged-in="${loggedIn ? "true" : "false"}">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6">
		<div class="flex items-start gap-3 min-w-0">
			<div class="w-10 h-10 shrink-0 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
				<i class="fa-solid fa-lock"></i>
			</div>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-xl font-semibold">Biến môi trường (.env)</h2>
					<span id="envStatusChip" class="px-2.5 py-0.5 rounded-full text-xs font-semibold border ${loggedIn ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30"}">${loggedIn ? `Đã đăng nhập${botName ? ` · ${escapeHtml(botName)}` : ""}` : "Chưa đăng nhập"}</span>
					<span id="envDirtyChip" class="hidden px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-indigo-500/15 text-indigo-200 border-indigo-500/30">Có thay đổi chưa lưu</span>
				</div>
				<p id="envSubtitle" class="text-sm text-slate-400 mt-1">${loggedIn ? "Bot đang chạy nên các secret được ẩn. Bấm &quot;Hiện .env&quot; khi cần chỉnh sửa." : "Bot chưa đăng nhập. Nhập TOKEN, bấm Test rồi chọn &quot;Lưu &amp; đăng nhập&quot; để bắt đầu."}</p>
			</div>
		</div>
		<button id="envToggleBtn" type="button" class="shrink-0 px-4 py-2 rounded-xl text-sm font-medium glass-input hover:bg-slate-700/60 transition flex items-center justify-center gap-2" aria-expanded="${loggedIn ? "false" : "true"}" aria-controls="envBody">
			<i id="envToggleIcon" class="fa-solid ${loggedIn ? "fa-eye" : "fa-eye-slash"}"></i>
			<span id="envToggleLabel">${loggedIn ? "Hiện .env" : "Ẩn .env"}</span>
		</button>
	</div>

	<div id="envBody" class="${loggedIn ? "hidden " : ""}px-5 md:px-6 pb-5 md:pb-6 border-t border-slate-700/50 pt-5 space-y-4">
		<div id="envBanner" class="rounded-xl px-4 py-3 text-sm border"></div>
		<div id="envLoading" class="text-sm text-slate-400 flex items-center gap-2"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải .env...</div>
		<div id="envError" class="hidden rounded-xl px-4 py-3 text-sm border bg-rose-500/10 border-rose-500/30 text-rose-200"></div>

		<div id="envForm" class="hidden space-y-4">
			<p id="envFileNote" class="hidden text-xs text-amber-300"></p>
			<div id="envGroups" class="space-y-4"></div>
			<div id="envExtras" class="rounded-xl bg-slate-900/40 border border-slate-700/50 p-4 space-y-3"></div>
			<div class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<button id="envReloadBtn" type="button" class="px-4 py-2 rounded-xl text-sm font-medium glass-input hover:bg-slate-700/60 transition flex items-center gap-2">
					<i class="fa-solid fa-rotate"></i> Tải lại từ file
				</button>
				<div class="flex flex-wrap gap-2">
					<button id="envSaveBtn" type="button" class="px-4 py-2 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition flex items-center gap-2 disabled:opacity-50">
						<i class="fa-solid fa-floppy-disk"></i> Lưu .env
					</button>
					<button id="envLoginBtn" type="button" class="${loggedIn ? "hidden " : ""}px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 disabled:opacity-50">
						<i class="fa-solid fa-right-to-bracket"></i> Lưu &amp; đăng nhập
					</button>
				</div>
			</div>
		</div>
	</div>
</section>`;

const ENV_UI_SCRIPT = String.raw`
(function () {
	'use strict';

	var INPUT = 'glass-input w-full min-w-0 px-3.5 py-2.5 rounded-xl text-sm';
	var BTN = 'px-3 py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
	var BTN_GHOST = BTN + ' glass-input hover:bg-slate-700/60';
	var BTN_PRIMARY = BTN + ' bg-indigo-600 hover:bg-indigo-500 text-white';
	var KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
	var QUOTES_RE = /^[\x22\x27\x60]|[\x22\x27\x60]$/g;

	var fields = {};
	ENV_SCHEMA.forEach(function (group) {
		group.fields.forEach(function (field) { fields[field.key] = field; });
	});

	var state = {
		open: !ENV_BOOT.loggedIn,
		loggedIn: !!ENV_BOOT.loggedIn,
		botId: ENV_BOOT.botId || null,
		botName: ENV_BOOT.botName || '',
		mainBotId: null,
		loaded: false,
		loading: false,
		busy: false,
		original: {},
		tests: {},
		tokens: [],
		extras: [],
		removed: [],
		newTest: null
	};

	/* ---------- small helpers ---------- */
	function $(id) { return document.getElementById(id); }
	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) node.className = cls;
		if (text !== undefined) node.textContent = text;
		return node;
	}
	function ic(cls) { var i = document.createElement('i'); i.className = cls; return i; }
	function append(parent) {
		for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
		return parent;
	}
	function toast(message, good) { if (typeof showToast === 'function') showToast(message, good !== false); }
	function api(path, body) {
		var options = { headers: { 'Accept': 'application/json' }, cache: 'no-store' };
		if (body !== undefined) {
			options.method = 'POST';
			options.headers['Content-Type'] = 'application/json';
			options.body = JSON.stringify(body);
		}
		return fetch(path, options).then(function (response) {
			return response.json().catch(function () { return { status: 'ERROR', error: 'Phản hồi không hợp lệ từ máy chủ.' }; });
		});
	}
	function normList(value) {
		var seen = {};
		var out = [];
		String(value || '').split(/[,\r\n]+/).forEach(function (part) {
			var token = part.trim().replace(QUOTES_RE, '').trim();
			if (token && !seen[token]) { seen[token] = true; out.push(token); }
		});
		return out;
	}
	function cleanToken(value) { return String(value || '').trim().replace(QUOTES_RE, '').replace(/^Bot\s+/i, '').trim(); }
	function mask(token) { return token.length > 16 ? token.slice(0, 6) + '••••••••' + token.slice(-4) : '••••••••'; }
	function randomHex(bytes) {
		var array = new Uint8Array(bytes);
		crypto.getRandomValues(array);
		return Array.prototype.map.call(array, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
	}

	function setStatus(node, level, message, bot) {
		node.replaceChildren();
		if (!level) { node.className = ''; return; }
		var colors = { ok: 'text-emerald-300', warn: 'text-amber-300', error: 'text-rose-300', loading: 'text-slate-300' };
		var icons = {
			ok: 'fa-solid fa-circle-check',
			warn: 'fa-solid fa-triangle-exclamation',
			error: 'fa-solid fa-circle-xmark',
			loading: 'fa-solid fa-spinner fa-spin'
		};
		node.className = 'flex items-start gap-2 text-xs mt-1.5 ' + (colors[level] || 'text-slate-300');
		node.appendChild(ic((icons[level] || icons.loading) + ' mt-0.5 shrink-0'));
		if (bot && bot.avatar) {
			var img = el('img', 'w-5 h-5 rounded-full shrink-0');
			img.src = bot.avatar;
			img.alt = '';
			img.referrerPolicy = 'no-referrer';
			node.appendChild(img);
		}
		node.appendChild(el('span', 'break-words min-w-0', message));
	}

	function eyeButton(input) {
		var button = el('button', BTN_GHOST);
		button.type = 'button';
		button.title = 'Hiện / ẩn giá trị';
		var icon = ic('fa-solid fa-eye');
		button.appendChild(icon);
		button.addEventListener('click', function () {
			var reveal = input.type === 'password';
			input.type = reveal ? 'text' : 'password';
			icon.className = reveal ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
		});
		return button;
	}

	function testButton(label) {
		var button = el('button', BTN_GHOST);
		button.type = 'button';
		append(button, ic('fa-solid fa-flask'), el('span', '', label || 'Test'));
		return button;
	}

	function runTest(key, value, statusNode, button) {
		if (button) button.disabled = true;
		setStatus(statusNode, 'loading', 'Đang kiểm tra...');
		var context = {};
		var mainToken = $('env_TOKEN');
		if (mainToken && mainToken.value.trim()) context.TOKEN = mainToken.value.trim();
		return api('/api/config/env/test', { key: key, value: value, context: context })
			.then(function (res) {
				if (button) button.disabled = false;
				if (res.status !== 'OK' || !res.result) {
					setStatus(statusNode, 'error', res.error || 'Không thể kiểm tra.');
					return null;
				}
				setStatus(statusNode, res.result.level, res.result.message, res.result.bot);
				return res.result;
			})
			.catch(function (error) {
				if (button) button.disabled = false;
				setStatus(statusNode, 'error', 'Lỗi kết nối: ' + error.message);
				return null;
			});
	}

	/* ---------- single value fields ---------- */
	function setInputValue(input, value) {
		if (input.tagName === 'SELECT') {
			var exists = Array.prototype.some.call(input.options, function (o) { return o.value === value; });
			if (!exists) { var extra = el('option', '', value); extra.value = value; input.appendChild(extra); }
		}
		input.value = value;
	}

	function renderSimple(field, value) {
		var row = el('div', 'flex gap-2');
		var status = el('div');
		status.id = 'envStatus_' + field.key;
		var input;
		if (field.type === 'select') {
			input = el('select', INPUT);
			field.options.forEach(function (option) {
				var node = el('option', '', option === '' ? '(không đặt)' : option);
				node.value = option;
				input.appendChild(node);
			});
		} else {
			input = el('input', INPUT + ' font-mono');
			input.type = field.type === 'secret' ? 'password' : 'text';
			input.autocomplete = field.type === 'secret' ? 'new-password' : 'off';
			input.spellcheck = false;
			input.placeholder = field.placeholder || '';
		}
		input.id = 'env_' + field.key;
		setInputValue(input, value);
		row.appendChild(input);

		if (field.type === 'secret') row.appendChild(eyeButton(input));
		if (field.generate) {
			var generate = el('button', BTN_GHOST);
			generate.type = 'button';
			generate.title = 'Tạo chuỗi ngẫu nhiên';
			generate.appendChild(ic('fa-solid fa-dice'));
			generate.addEventListener('click', function () {
				input.value = randomHex(32);
				input.type = 'text';
				input.dispatchEvent(new Event('input', { bubbles: true }));
			});
			row.appendChild(generate);
		}
		if (field.testable) {
			var button = testButton('Test');
			button.title = field.testable === 'live' ? 'Kiểm tra thật với dịch vụ' : 'Kiểm tra định dạng';
			button.addEventListener('click', function () {
				var current = input.value.trim();
				runTest(field.key, current, status, button).then(function (result) {
					if (!result) return;
					state.tests[field.key] = { value: current, ok: result.ok };
					if (field.key === 'TOKEN' && result.bot) state.mainBotId = result.bot.id;
				});
			});
			row.appendChild(button);
		}
		input.addEventListener('input', function () {
			var test = state.tests[field.key];
			if (test && test.value !== input.value.trim()) { delete state.tests[field.key]; setStatus(status, null); }
		});
		return [row, status];
	}

	/* ---------- MULTI_PLAYER_TOKEN list ---------- */
	function duplicateReason(botId) {
		if (botId && (botId === state.mainBotId || botId === state.botId)) return 'Đây là bot chính. Bot phụ phải là một bot khác.';
		var clash = state.tokens.some(function (item) { return item.bot && item.bot.id === botId; });
		return clash ? 'Bot này đã có trong danh sách (hai token khác nhau nhưng cùng một bot).' : '';
	}

	function renderTokens() {
		var list = $('envTokenList');
		if (!list) return;
		list.replaceChildren();
		var count = $('envTokenCount');
		if (count) count.textContent = state.tokens.length + ' bot phụ';
		if (!state.tokens.length) {
			list.appendChild(el('div', 'text-xs text-slate-400 px-1', 'Chưa có bot phụ nào. Khi để trống, chỉ bot chính phát nhạc.'));
			return;
		}
		state.tokens.forEach(function (item, index) {
			var failed = item.level === 'error';
			var row = el('div', 'flex items-start gap-3 rounded-xl bg-slate-800/50 border px-3 py-2.5 ' + (failed ? 'border-rose-500/50' : 'border-slate-700/60'));
			var avatar;
			if (item.bot && item.bot.avatar) {
				avatar = el('img', 'w-9 h-9 rounded-full shrink-0');
				avatar.src = item.bot.avatar;
				avatar.alt = '';
				avatar.referrerPolicy = 'no-referrer';
			} else {
				avatar = el('div', 'w-9 h-9 rounded-full shrink-0 bg-slate-700 flex items-center justify-center text-slate-300');
				avatar.appendChild(ic('fa-solid fa-robot'));
			}
			var info = el('div', 'min-w-0 flex-1');
			var title = item.bot ? item.bot.name + ' (' + item.bot.id + ')' : 'Bot phụ #' + (index + 1);
			append(info, el('div', 'text-sm font-medium text-slate-100 truncate', title), el('div', 'text-xs text-slate-400 font-mono truncate', mask(item.token)));
			var status = el('div');
			if (item.level) setStatus(status, item.level, item.message || '');
			else { status.className = 'text-xs text-slate-500 mt-1.5'; status.textContent = 'Chưa test'; }
			info.appendChild(status);

			var actions = el('div', 'flex gap-1.5 shrink-0');
			var retest = testButton('Test');
			retest.addEventListener('click', function () {
				runTest('MULTI_PLAYER_TOKEN', item.token, status, retest).then(function (result) {
					if (!result) return;
					item.level = result.level;
					item.message = result.message;
					if (result.bot) item.bot = result.bot;
					renderTokens();
				});
			});
			var remove = el('button', BTN_GHOST + ' text-rose-300 hover:!bg-rose-500/20');
			remove.type = 'button';
			remove.title = 'Xóa khỏi danh sách';
			remove.appendChild(ic('fa-solid fa-trash'));
			remove.addEventListener('click', function () {
				state.tokens.splice(index, 1);
				renderTokens();
				refreshDirty();
			});
			append(actions, retest, remove);
			append(row, avatar, info, actions);
			list.appendChild(row);
		});
	}

	function testAllTokens() {
		var chain = Promise.resolve();
		state.tokens.forEach(function (item) {
			chain = chain.then(function () {
				var probe = el('div');
				return runTest('MULTI_PLAYER_TOKEN', item.token, probe, null).then(function (result) {
					if (!result) return;
					item.level = result.level;
					item.message = result.message;
					if (result.bot) item.bot = result.bot;
					renderTokens();
				});
			});
		});
		return chain;
	}

	function renderTokenList() {
		var box = el('div', 'space-y-3');
		var head = el('div', 'flex items-center justify-between gap-2');
		var count = el('span', 'text-xs text-slate-400');
		count.id = 'envTokenCount';
		var all = el('button', BTN_GHOST + ' !py-1.5 text-xs');
		all.type = 'button';
		append(all, ic('fa-solid fa-flask'), el('span', '', 'Test tất cả'));
		all.addEventListener('click', function () {
			all.disabled = true;
			testAllTokens().then(function () { all.disabled = false; });
		});
		append(head, count, all);

		var list = el('div', 'space-y-2');
		list.id = 'envTokenList';

		var add = el('div', 'rounded-xl border border-dashed border-slate-600/80 p-3 space-y-2');
		add.appendChild(el('div', 'text-sm font-medium text-slate-200', 'Thêm bot phụ mới'));
		var row = el('div', 'flex gap-2');
		var input = el('input', INPUT + ' font-mono');
		input.id = 'env_newToken';
		input.type = 'password';
		input.autocomplete = 'new-password';
		input.spellcheck = false;
		input.placeholder = 'Dán token bot phụ, bấm Test, rồi mới thêm vào danh sách';
		var test = testButton('Test');
		append(row, input, eyeButton(input), test);
		var status = el('div');
		status.id = 'envStatus_newToken';
		var addButton = el('button', BTN_PRIMARY + ' w-full sm:w-auto');
		addButton.type = 'button';
		addButton.disabled = true;
		append(addButton, ic('fa-solid fa-plus'), el('span', '', 'Thêm vào danh sách'));
		append(add, row, status, addButton);

		function resetNew() { state.newTest = null; addButton.disabled = true; }
		function doTest() {
			resetNew();
			var token = cleanToken(input.value);
			if (!token) { setStatus(status, 'error', 'Hãy dán token trước.'); return; }
			if (state.tokens.some(function (item) { return item.token === token; })) {
				setStatus(status, 'error', 'Token này đã có trong danh sách.');
				return;
			}
			runTest('MULTI_PLAYER_TOKEN', token, status, test).then(function (result) {
				if (!result || !result.ok || !result.bot) return;
				var reason = duplicateReason(result.bot.id);
				if (reason) { setStatus(status, 'error', reason); return; }
				state.newTest = { token: token, result: result };
				addButton.disabled = false;
			});
		}
		test.addEventListener('click', doTest);
		input.addEventListener('keydown', function (event) {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			if (state.newTest) addButton.click(); else doTest();
		});
		input.addEventListener('input', function () {
			if (state.newTest && state.newTest.token !== cleanToken(input.value)) { resetNew(); setStatus(status, null); }
		});
		addButton.addEventListener('click', function () {
			var pending = state.newTest;
			if (!pending) return;
			state.tokens.push({ token: pending.token, bot: pending.result.bot, level: pending.result.level, message: pending.result.message });
			input.value = '';
			resetNew();
			setStatus(status, null);
			renderTokens();
			refreshDirty();
			toast('Đã thêm ' + pending.result.bot.name + ' vào danh sách. Nhớ bấm "Lưu .env".');
		});

		append(box, head, list, add);
		return box;
	}

	/* ---------- groups ---------- */
	function renderGroups() {
		var root = $('envGroups');
		root.replaceChildren();
		ENV_SCHEMA.forEach(function (group) {
			var card = el('div', 'rounded-xl bg-slate-900/40 border border-slate-700/50 p-4 space-y-4');
			var title = el('div', 'flex items-center gap-2 text-sm font-semibold text-slate-100');
			append(title, ic(group.icon + ' text-indigo-400'), el('span', '', group.title));
			var grid = el('div', 'grid grid-cols-1 lg:grid-cols-2 gap-4');
			group.fields.forEach(function (field) {
				var wide = field.type === 'tokenList' || field.key === 'MONGO';
				var cell = el('div', 'space-y-1.5 min-w-0' + (wide ? ' lg:col-span-2' : ''));
				var label = el('label', 'block text-sm font-medium text-slate-300', field.label);
				if (field.required) label.appendChild(el('span', 'text-rose-400', ' *'));
				cell.appendChild(label);
				if (field.type === 'tokenList') {
					cell.appendChild(renderTokenList());
				} else {
					var parts = renderSimple(field, String(state.original[field.key] || ''));
					label.htmlFor = 'env_' + field.key;
					append(cell, parts[0], parts[1]);
				}
				if (field.help) cell.appendChild(el('p', 'text-xs text-slate-400', field.help));
				grid.appendChild(cell);
			});
			append(card, title, grid);
			root.appendChild(card);
		});
		renderTokens();
	}

	/* ---------- extra variables ---------- */
	function renderExtras() {
		var box = $('envExtras');
		box.replaceChildren();
		var title = el('div', 'flex items-center gap-2 text-sm font-semibold text-slate-100');
		append(title, ic('fa-solid fa-list text-indigo-400'), el('span', '', 'Biến khác'));
		box.appendChild(title);
		box.appendChild(el('p', 'text-xs text-slate-400', 'Các biến trong .env không nằm ở các nhóm trên. Bạn có thể sửa, xóa hoặc thêm biến mới.'));

		state.extras.forEach(function (item, index) {
			var row = el('div', 'flex flex-col sm:flex-row gap-2');
			row.appendChild(el('div', 'sm:w-56 shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-mono bg-slate-800/60 border border-slate-700/60 truncate', item.key));
			var input = el('input', INPUT + ' font-mono');
			input.type = 'password';
			input.autocomplete = 'new-password';
			input.spellcheck = false;
			input.value = item.value;
			input.addEventListener('input', function () { item.value = input.value; });
			var remove = el('button', BTN_GHOST + ' text-rose-300 hover:!bg-rose-500/20');
			remove.type = 'button';
			remove.title = 'Xóa biến này';
			remove.appendChild(ic('fa-solid fa-trash'));
			remove.addEventListener('click', function () {
				if (!item.isNew) state.removed.push(item.key);
				state.extras.splice(index, 1);
				renderExtras();
				refreshDirty();
			});
			append(row, input, eyeButton(input), remove);
			box.appendChild(row);
		});

		var addRow = el('div', 'flex flex-col sm:flex-row gap-2 pt-1');
		var keyInput = el('input', INPUT + ' font-mono sm:w-56 sm:shrink-0');
		keyInput.placeholder = 'TEN_BIEN';
		keyInput.spellcheck = false;
		var valueInput = el('input', INPUT + ' font-mono');
		valueInput.placeholder = 'Giá trị';
		valueInput.spellcheck = false;
		var addBtn = el('button', BTN_GHOST);
		addBtn.type = 'button';
		append(addBtn, ic('fa-solid fa-plus'), el('span', '', 'Thêm biến'));
		addBtn.addEventListener('click', function () {
			var key = keyInput.value.trim();
			if (!KEY_RE.test(key) || key === '__proto__') return toast('Tên biến chỉ gồm chữ, số, _ . - và không bắt đầu bằng số.', false);
			if (fields[key]) return toast(key + ' đã có ở các nhóm phía trên.', false);
			if (state.extras.some(function (item) { return item.key === key; })) return toast(key + ' đã tồn tại.', false);
			var wasRemoved = state.removed.indexOf(key);
			if (wasRemoved !== -1) state.removed.splice(wasRemoved, 1);
			state.extras.push({ key: key, value: valueInput.value, isNew: !Object.prototype.hasOwnProperty.call(state.original, key) });
			renderExtras();
			refreshDirty();
		});
		append(addRow, keyInput, valueInput, addBtn);
		box.appendChild(addRow);
	}

	/* ---------- changes / dirty state ---------- */
	function currentValue(key) {
		if (key === 'MULTI_PLAYER_TOKEN') return state.tokens.map(function (item) { return item.token; }).join(',');
		var input = $('env_' + key);
		return input ? input.value.trim() : null;
	}

	function collectChanges() {
		var values = {};
		Object.keys(fields).forEach(function (key) {
			var now = currentValue(key);
			if (now === null) return;
			var before = key === 'MULTI_PLAYER_TOKEN' ? normList(state.original[key]).join(',') : String(state.original[key] || '');
			if (now !== before) values[key] = now;
		});
		state.extras.forEach(function (item) {
			var now = item.value.trim();
			var before = String(state.original[item.key] || '');
			if (item.isNew ? now !== '' : now !== before) values[item.key] = now;
		});
		return { values: values, remove: state.removed.slice() };
	}

	function hasChanges(changes) { return Object.keys(changes.values).length > 0 || changes.remove.length > 0; }

	function refreshDirty() {
		var chip = $('envDirtyChip');
		if (!state.loaded) { chip.classList.add('hidden'); return false; }
		var dirty = hasChanges(collectChanges());
		chip.classList.toggle('hidden', !dirty);
		return dirty;
	}

	function untestedLabels(changes) {
		var out = [];
		Object.keys(changes.values).forEach(function (key) {
			var field = fields[key];
			if (!field || !field.testable || changes.values[key] === '') return;
			if (key === 'MULTI_PLAYER_TOKEN') {
				var before = normList(state.original[key]);
				var bad = state.tokens.filter(function (item) {
					return item.level === 'error' || (before.indexOf(item.token) === -1 && item.level !== 'ok' && item.level !== 'warn');
				});
				if (bad.length) out.push(field.label + ' (' + bad.length + ' token chưa hợp lệ)');
				return;
			}
			var test = state.tests[key];
			if (!test || test.value !== changes.values[key] || !test.ok) out.push(field.label);
		});
		return out;
	}

	/* ---------- load / save ---------- */
	function setBusy(busy) {
		state.busy = busy;
		['envSaveBtn', 'envLoginBtn', 'envReloadBtn'].forEach(function (id) { $(id).disabled = busy; });
	}

	function updateHeader() {
		var chip = $('envStatusChip');
		var base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold border ';
		if (state.loggedIn) {
			chip.className = base + 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
			chip.textContent = 'Đã đăng nhập' + (state.botName ? ' · ' + state.botName : '');
			$('envSubtitle').textContent = 'Bot đang chạy nên các secret được ẩn. Bấm "Hiện .env" khi cần chỉnh sửa.';
		} else {
			chip.className = base + 'bg-amber-500/15 text-amber-300 border-amber-500/30';
			chip.textContent = 'Chưa đăng nhập';
			$('envSubtitle').textContent = 'Bot chưa đăng nhập. Nhập TOKEN, bấm Test rồi chọn "Lưu & đăng nhập" để bắt đầu.';
		}
		$('envLoginBtn').classList.toggle('hidden', state.loggedIn);

		var banner = $('envBanner');
		if (state.loggedIn) {
			banner.className = 'rounded-xl px-4 py-3 text-sm border bg-slate-800/50 border-slate-700/60 text-slate-300';
			banner.textContent = 'Thay đổi trong .env chỉ có hiệu lực sau khi khởi động lại bot.';
		} else {
			banner.className = 'rounded-xl px-4 py-3 text-sm border bg-amber-500/10 border-amber-500/30 text-amber-200';
			banner.textContent = 'Bot chưa đăng nhập nên .env đang được hiện sẵn. Điền TOKEN và bấm Test để kiểm tra trước khi lưu.';
		}
	}

	function wipe() {
		$('envGroups').replaceChildren();
		$('envExtras').replaceChildren();
		$('envForm').classList.add('hidden');
		state.loaded = false;
		state.original = {};
		state.tests = {};
		state.tokens = [];
		state.extras = [];
		state.removed = [];
		state.newTest = null;
	}

	function setOpen(open) {
		state.open = open;
		$('envBody').classList.toggle('hidden', !open);
		$('envToggleBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
		$('envToggleIcon').className = 'fa-solid ' + (open ? 'fa-eye-slash' : 'fa-eye');
		$('envToggleLabel').textContent = open ? 'Ẩn .env' : 'Hiện .env';
		if (open && !state.loaded) loadEnv();
		// Closing with nothing unsaved also removes the secrets from the page.
		if (!open && state.loaded && !refreshDirty()) wipe();
	}

	function showError(message) {
		var box = $('envError');
		box.textContent = message;
		box.classList.remove('hidden');
	}

	function loadEnv() {
		if (state.loading) return;
		state.loading = true;
		$('envLoading').classList.remove('hidden');
		$('envError').classList.add('hidden');
		$('envForm').classList.add('hidden');
		api('/api/config/env').then(function (res) {
			state.loading = false;
			$('envLoading').classList.add('hidden');
			if (res.status !== 'OK') return showError(res.error || 'Không thể đọc .env.');
			state.original = res.values || {};
			state.tests = {};
			state.removed = [];
			state.tokens = normList(state.original.MULTI_PLAYER_TOKEN).map(function (token) {
				return { token: token, bot: null, level: null, message: '' };
			});
			state.extras = Object.keys(state.original)
				.filter(function (key) { return !fields[key]; })
				.map(function (key) { return { key: key, value: state.original[key], isNew: false }; });
			state.loaded = true;
			renderGroups();
			renderExtras();
			var note = $('envFileNote');
			note.textContent = res.exists ? '' : 'Chưa có file .env. File sẽ được tạo từ .env.example khi bạn lưu.';
			note.classList.toggle('hidden', !!res.exists);
			$('envForm').classList.remove('hidden');
			refreshDirty();
		}).catch(function (error) {
			state.loading = false;
			$('envLoading').classList.add('hidden');
			showError('Lỗi kết nối máy chủ: ' + error.message);
		});
	}

	function markLoggedIn(bot) {
		state.loggedIn = true;
		state.botId = bot.id;
		state.botName = bot.tag || bot.id;
		updateHeader();
		setOpen(false);
	}

	function save(login) {
		if (state.busy || !state.loaded) return;
		var changes = collectChanges();
		if (!login && !hasChanges(changes)) return toast('Không có thay đổi nào để lưu.', false);
		if (login && !changes.values.TOKEN && !state.original.TOKEN) return toast('Hãy nhập TOKEN trước khi đăng nhập.', false);
		var untested = untestedLabels(changes);
		if (untested.length && !confirm('Các mục sau chưa được test hoặc test thất bại:\n- ' + untested.join('\n- ') + '\n\nVẫn tiếp tục lưu?')) return;

		setBusy(true);
		api(login ? '/api/config/login' : '/api/config/env', changes).then(function (res) {
			setBusy(false);
			if (res.values) {
				state.original = res.values;
				state.removed = [];
				state.extras.forEach(function (item) { item.isNew = false; });
				refreshDirty();
			}
			if (res.status === 'OK') {
				toast(res.message || 'Đã lưu .env.');
				if (login && res.bot) markLoggedIn(res.bot);
			} else {
				toast(res.error || 'Thao tác thất bại.', false);
			}
		}).catch(function (error) {
			setBusy(false);
			toast('Lỗi kết nối máy chủ: ' + error.message, false);
		});
	}

	/* ---------- init ---------- */
	document.addEventListener('DOMContentLoaded', function () {
		$('envToggleBtn').addEventListener('click', function () { setOpen(!state.open); });
		$('envSaveBtn').addEventListener('click', function () { save(false); });
		$('envLoginBtn').addEventListener('click', function () { save(true); });
		$('envReloadBtn').addEventListener('click', function () {
			if (refreshDirty() && !confirm('Bỏ các thay đổi chưa lưu và tải lại từ file .env?')) return;
			wipe();
			loadEnv();
		});
		var body = $('envBody');
		body.addEventListener('input', refreshDirty);
		body.addEventListener('change', refreshDirty);
		updateHeader();
		if (state.open) loadEnv();
	});
})();
`;

const renderEnvScript = ({ loggedIn = false, botId = null, botName = "" } = {}) =>
	`const ENV_SCHEMA = ${safeJson(ENV_SCHEMA)};\nconst ENV_BOOT = ${safeJson({ loggedIn, botId, botName })};\n${ENV_UI_SCRIPT}`;

module.exports = { renderEnvSection, renderEnvScript, escapeHtml };
