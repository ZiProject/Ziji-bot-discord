const crypto = require("node:crypto");
const express = require("express");
const { useHooks } = require("zihooks");

module.exports.data = { name: "guildCommandWeb", description: "Web graph editor for guild commands", version: "2.0.0", enable: true, priority: 8 };

module.exports.execute = (client) => {
	const router = express.Router();
	const sessions = new Map();
	const manager = useHooks.get("functions")?.get("guildCommandManager");

	const makeSession = (scope) => {
		const token = crypto.randomBytes(24).toString("hex");
		const password = crypto.randomBytes(6).toString("base64url");
		sessions.set(token, { ...scope, password, expiresAt: Date.now() + 86400000 });
		return { token, password };
	};

	const getSession = (req, res, requirePassword = true) => {
		const session = sessions.get(String(req.body?.token || req.query.token || ""));
		if (!requirePassword) {
			if (!session || session.expiresAt < Date.now()) { res.status(401).send("Link đã hết hạn."); return null; }
			return session;
		}
		const supplied = String(req.body?.password || req.get("x-editor-password") || "");
		if (!session || session.expiresAt < Date.now() || supplied.length !== session.password.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(session.password))) {
			res.status(401).json({ error: "Link hoặc mật khẩu không hợp lệ/hết hạn." });
			return null;
		}
		return session;
	};

	useHooks.get("functions")?.set("guildCommandWeb", { createSession: makeSession });

	router.get("/guildcommand/editor", (req, res) => {
		const session = getSession(req, res, false);
		if (!session) return;

		const html = `<!doctype html>
<html lang="vi" class="h-full bg-slate-950 text-slate-100 dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trình dựng lệnh /${session.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <style>
    .dot-grid { background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px); background-size: 20px 20px; }
    .node-port { width: 0.75rem; height: 0.75rem; border-radius: 9999px; border: 2px solid #0f172a; cursor: crosshair; transition: transform 0.15s; }
    .node-port:hover { transform: scale(1.25); }
  </style>
</head>
<body class="h-full flex flex-col font-sans overflow-hidden select-none">
  <!-- Top Header -->
  <header class="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
    <div class="flex items-center gap-3">
      <div class="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
        <i class="bi bi-diagram-3-fill text-xl"></i>
      </div>
      <div>
        <h1 class="font-bold text-sm tracking-wide">Trình dựng lệnh: <span class="text-indigo-400">/${session.name}</span></h1>
        <p class="text-xs text-slate-400">Server ID: ${session.guildId}</p>
      </div>
    </div>
    
    <div class="flex items-center gap-3">
      <label class="flex items-center gap-2 cursor-pointer bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50 hover:bg-slate-800">
        <input type="checkbox" id="enabled" checked class="w-4 h-4 rounded accent-indigo-500">
        <span class="text-xs font-medium">Kích hoạt</span>
      </label>
      <button onclick="save()" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
        <i class="bi bi-cloud-arrow-up-fill"></i> Lưu & Đăng ký
      </button>
    </div>
  </header>

  <!-- Main Body -->
  <div class="flex-1 flex overflow-hidden">
    <!-- Left Sidebar: Meta & Options -->
    <aside class="w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col z-10 shrink-0">
      <div class="p-4 border-b border-slate-800 space-y-3">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <i class="bi bi-sliders"></i> Cấu hình chính
        </h2>
        <div>
          <label class="text-[11px] text-slate-400 mb-1 block">Tên lệnh</label>
          <input id="name" value="${session.name}" maxlength="32" class="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>
        <div>
          <label class="text-[11px] text-slate-400 mb-1 block">Mô tả</label>
          <input id="description" maxlength="100" placeholder="Mô tả slash command..." class="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>
      </div>

      <!-- Options List -->
      <div class="flex-1 flex flex-col p-4 overflow-hidden">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <i class="bi bi-list-nested"></i> Tham số (Options)
          </h2>
          <button onclick="addOption()" class="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-2 py-1 rounded transition-colors flex items-center gap-1">
            <i class="bi bi-plus-lg"></i> Thêm
          </button>
        </div>
        
        <div id="options" class="flex-1 overflow-y-auto space-y-2 pr-1"></div>
      </div>

      <!-- Footer Info -->
      <div class="p-3 bg-slate-950/50 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
        <i class="bi bi-info-circle text-indigo-400"></i>
        <span id="status">Sẵn sàng dựng luồng.</span>
      </div>
    </aside>

    <!-- Visual Editor Area -->
    <main class="flex-1 flex flex-col relative bg-slate-950">
      <!-- Toolbar -->
      <div class="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md">
        <span class="text-xs text-slate-400 px-2 font-medium">Thêm khối:</span>
        <button onclick="addNode('reply')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 text-indigo-300 transition-all">
          <i class="bi bi-reply-fill"></i> Reply
        </button>
        <button onclick="addNode('send-channel')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 text-emerald-300 transition-all">
          <i class="bi bi-hash"></i> Kênh
        </button>
        <button onclick="addNode('send-dm')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 text-sky-300 transition-all">
          <i class="bi bi-envelope-fill"></i> DM
        </button>
        <button onclick="addNode('role-edit')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 text-amber-300 transition-all">
          <i class="bi bi-shield-lock-fill"></i> Role
        </button>
        <button onclick="addNode('has-role')" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 text-rose-300 transition-all">
          <i class="bi bi-git-branch"></i> Kiểm tra
        </button>
      </div>

      <!-- Interactive Canvas -->
      <div id="canvas-container" class="flex-1 w-full h-full relative overflow-hidden dot-grid">
        <svg id="connections-svg" class="absolute inset-0 w-full h-full pointer-events-none z-0"></svg>
        <div id="nodes-container" class="absolute inset-0 z-10"></div>
      </div>
    </main>
  </div>

<script>
const token = ${JSON.stringify(req.query.token)}, guildId = ${JSON.stringify(session.guildId)};
let password = window.prompt('Nhập mật khẩu để mở trình dựng') || '';
let guildData = { channels: [], roles: [], members: [] };
let options = [], nodes = [];
let draggingNode = null, dragOffset = { x: 0, y: 0 };
let activeConnection = null;

const types = ['String', 'User', 'Channel', 'Role', 'Boolean', 'Option'];
const $ = id => document.getElementById(id);
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeSuggestionIndex = 0;

function changeOptionType(index, value) {
  if (!options[index] || !types.includes(value)) return;
  options[index].type = value;
  renderOptions();
  renderGraph();
}

function updateMessageSuggestions(nodeIndex, textarea) {
  nodes[nodeIndex].data.msg = textarea.value;
  const box = $('variable-suggestions-' + nodeIndex);
  const cursor = textarea.selectionStart;
  const match = textarea.value.slice(0, cursor).match(/\\{([^{}\\s]*)$/);
  if (!match) { box.classList.add('hidden'); return; }

  const prefix = match[1].toLowerCase();
  const choices = options.filter(option => option.name && option.name.toLowerCase().startsWith(prefix));
  box.replaceChildren();
  if (!choices.length) { box.classList.add('hidden'); return; }

  activeSuggestionIndex = 0;
  choices.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'block w-full px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-indigo-500/20';
    button.textContent = '{' + option.name + '} · ' + option.type + ' · ' + option.id;
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => insertVariable(nodeIndex, textarea, option.name));
    if (index === activeSuggestionIndex) button.classList.add('bg-indigo-500/20');
    box.appendChild(button);
  });
  box.dataset.replaceFrom = String(cursor - match[0].length);
  box.dataset.replaceTo = String(cursor);
  box.classList.remove('hidden');
}

function insertVariable(nodeIndex, textarea, name) {
  const box = $('variable-suggestions-' + nodeIndex);
  const start = Number(box.dataset.replaceFrom);
  const end = Number(box.dataset.replaceTo);
  const insertion = '{' + name + '}';
  textarea.value = textarea.value.slice(0, start) + insertion + textarea.value.slice(end);
  textarea.setSelectionRange(start + insertion.length, start + insertion.length);
  nodes[nodeIndex].data.msg = textarea.value;
  box.classList.add('hidden');
  textarea.focus();
}

function handleMessageKeydown(event, nodeIndex, textarea) {
  const box = $('variable-suggestions-' + nodeIndex);
  const buttons = [...box.querySelectorAll('button')];
  if (box.classList.contains('hidden') || !buttons.length) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    activeSuggestionIndex = (activeSuggestionIndex + delta + buttons.length) % buttons.length;
    buttons.forEach((button, index) => button.classList.toggle('bg-indigo-500/20', index === activeSuggestionIndex));
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    const choice = buttons[activeSuggestionIndex]?.textContent.match(/^\\{([^}]+)\\}/)?.[1];
    if (choice) insertVariable(nodeIndex, textarea, choice);
  } else if (event.key === 'Escape') {
    box.classList.add('hidden');
  }
}

const nodeMeta = {
  'reply': { title: 'Reply Interaction', color: 'border-indigo-500/40 bg-indigo-950/20', icon: 'bi-reply-fill', badge: 'bg-indigo-500/20 text-indigo-300' },
  'send-channel': { title: 'Gửi vào Kênh', color: 'border-emerald-500/40 bg-emerald-950/20', icon: 'bi-hash', badge: 'bg-emerald-500/20 text-emerald-300' },
  'send-dm': { title: 'Gửi DM User', color: 'border-sky-500/40 bg-sky-950/20', icon: 'bi-envelope-fill', badge: 'bg-sky-500/20 text-sky-300' },
  'role-edit': { title: 'Thay đổi Role', color: 'border-amber-500/40 bg-amber-950/20', icon: 'bi-shield-lock-fill', badge: 'bg-amber-500/20 text-amber-300' },
  'has-role': { title: 'Rẽ nhánh: Kiểm tra Role', color: 'border-rose-500/40 bg-rose-950/20', icon: 'bi-git-branch', badge: 'bg-rose-500/20 text-rose-300' }
};

async function init() {
  let r = await fetch('/guildcommand/api/meta?token=' + encodeURIComponent(token), { headers: { 'x-editor-password': password } });
  if (r.status === 401) {
    password = window.prompt('Mật khẩu không đúng. Nhập lại:') || '';
    if (!password) { $('status').textContent = 'Cần nhập mật khẩu để tiếp tục'; return; }
    return init();
  }
  if (!r.ok) { $('status').textContent = 'Link đã hết hạn hoặc không hợp lệ'; return; }
  
  let d = await r.json();
  $('name').value = d.record?.name || d.name;
  $('description').value = d.record?.description || '';
  $('enabled').checked = d.record?.enabled ?? true;
  options = d.record?.response?.options || [];
  options.forEach(o => { if (!o.id) o.id = crypto.randomUUID(); });
  
  nodes = d.record?.response?.graph || [];
  nodes.forEach((n, idx) => {
    if (n.x === undefined) n.x = 80 + (idx % 3) * 320;
    if (n.y === undefined) n.y = 80 + Math.floor(idx / 3) * 260;
  });

  guildData = d.guild;
  renderOptions();
  renderGraph();
}

function addOption() {
  options.push({ id: crypto.randomUUID(), name: '', description: '', type: 'String', required: false });
  renderOptions();
  renderGraph();
}

function renderOptions() {
  let html = '';
  options.forEach((o, i) => {
    let typeOpts = types.map(t => '<option value="' + t + '" ' + (o.type === t ? 'selected' : '') + '>' + t + '</option>').join('');
    html += '<div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs relative group">' +
      '<div class="flex items-center justify-between gap-1"><code class="text-[9px] text-slate-500" title="ID duy nhất của option">ID: ' + esc(o.id) + '</code>' +
        '<input placeholder="Tên option" value="' + esc(o.name) + '" onchange="options[' + i + '].name=this.value;renderGraph()" class="bg-slate-900 border border-slate-700/60 rounded px-2 py-1 font-mono text-indigo-300 w-full focus:outline-none focus:border-indigo-500">' +
        '<button onclick="options.splice(' + i + ',1);renderOptions();renderGraph()" class="text-slate-500 hover:text-rose-400 p-1"><i class="bi bi-trash"></i></button>' +
      '</div>' +
      '<input placeholder="Mô tả" value="' + esc(o.description) + '" onchange="options[' + i + '].description=this.value" class="bg-slate-900 border border-slate-800 rounded px-2 py-1 w-full text-slate-300">' +
      '<div class="flex items-center gap-2">' +
        '<select onchange="changeOptionType(' + i + ', this.value)" class="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-300 flex-1">' + typeOpts + '</select>' +
        '<label class="flex items-center gap-1 text-slate-400 cursor-pointer">' +
          '<input type="checkbox" ' + (o.required ? 'checked' : '') + ' onchange="options[' + i + '].required=this.checked" class="rounded accent-indigo-500"> Req' +
        '</label>' +
      '</div>' +
      (o.type === 'Option' ? '<input placeholder="lựa chọn: a,b,c" value="' + esc((o.choices||[]).join(',')) + '" onchange="options[' + i + '].choices=this.value.split(&quot;,&quot;).map(x=>x.trim()).filter(Boolean)" class="bg-slate-900 border border-slate-800 rounded px-2 py-1 w-full text-slate-400">' : '') +
    '</div>';
  });
  $('options').innerHTML = html;
}

function addNode(type) {
  const id = 'node_' + Math.random().toString(36).substr(2, 6);
  nodes.push({ id, type, data: { msg: '' }, x: 120 + Math.random() * 80, y: 120 + Math.random() * 80 });
  renderGraph();
}

function deleteNode(id) {
  nodes = nodes.filter(n => n.id !== id);
  nodes.forEach(n => {
    if (n.next === id) delete n.next;
    if (n.data?.yes === id) delete n.data.yes;
    if (n.data?.no === id) delete n.data.no;
  });
  renderGraph();
}

function fieldSelect(nodeIdx, key, label, list) {
  const v = nodes[nodeIdx].data[key] || '';
  const opts = list.map(x => '<option value="' + esc(x.id||x) + '" ' + ((x.id||x) === v ? 'selected' : '') + '>' + esc(x.name||x) + '</option>').join('');
  return '<div class="space-y-1">' +
    '<label class="text-[10px] text-slate-400 uppercase font-semibold">' + label + '</label>' +
    '<select onchange="nodes[' + nodeIdx + '].data.' + key + '=this.value" class="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">' +
      '<option value="">-- Chọn --</option>' + opts +
    '</select>' +
  '</div>';
}

function renderGraph() {
  const vars = t => options.filter(x => x.type === t && x.name).map(x => ({ id: x.id, name: '[Var] ' + x.name + ' [' + x.id + ']' }));
  const currentChannel = { id: '__current_channel__', name: 'Kênh hiện tại (Channel)' };
  const currentUser = { id: '__current_user__', name: 'Người dùng hiện tại (User)' };
  const container = $('nodes-container');
  container.innerHTML = '';

  nodes.forEach((n, i) => {
    n.data = n.data || {};
    const meta = nodeMeta[n.type] || nodeMeta['reply'];
    
    let fields = '';
    if (n.type === 'send-channel') fields += fieldSelect(i, 'channel', 'Kênh đích', [currentChannel, ...guildData.channels, ...vars('Channel')]);
    if (n.type === 'send-dm') fields += fieldSelect(i, 'user', 'User nhận DM', [currentUser, ...guildData.members, ...vars('User')]);
    if (n.type === 'role-edit') {
      fields += fieldSelect(i, 'role', 'Role', [...guildData.roles, ...vars('Role')]);
      fields += fieldSelect(i, 'user', 'User', [currentUser, ...guildData.members, ...vars('User')]);
      fields += '<div class="space-y-1">' +
        '<label class="text-[10px] text-slate-400 uppercase font-semibold">Hành động</label>' +
        '<select onchange="nodes[' + i + '].data.action=this.value" class="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200">' +
          '<option value="add">Cấp Role (Add)</option>' +
          '<option value="delete" ' + (n.data.action === 'delete' ? 'selected' : '') + '>Gỡ Role (Delete)</option>' +
        '</select>' +
      '</div>';
    }
    if (n.type === 'has-role') {
      fields += fieldSelect(i, 'role', 'Role kiểm tra', [...guildData.roles, ...vars('Role')]);
      fields += fieldSelect(i, 'user', 'User kiểm tra', [currentUser, ...guildData.members, ...vars('User')]);
    }
    if (['reply', 'send-channel', 'send-dm'].includes(n.type)) {
      fields += '<div class="space-y-1">' +
        '<label class="text-[10px] text-slate-400 uppercase font-semibold">Nội dung tin nhắn</label>' +
        '<div class="relative"><textarea data-message-node="' + i + '" class="w-full bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 h-16 resize-none focus:outline-none focus:border-indigo-500" placeholder="Gõ { để chèn biến...">' + esc(n.data.msg) + '</textarea>' +
        '<div id="variable-suggestions-' + i + '" class="hidden absolute left-0 right-0 bottom-full z-30 mb-1 max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl"></div></div>' +
      '</div>';
    }

    const nodeEl = document.createElement('div');
    nodeEl.className = 'absolute w-72 bg-slate-900/95 border ' + meta.color + ' rounded-xl shadow-2xl backdrop-blur-md flex flex-col z-10 group transition-shadow hover:shadow-indigo-500/10';
    nodeEl.style.left = n.x + 'px';
    nodeEl.style.top = n.y + 'px';
    nodeEl.id = 'node-element-' + n.id;

    const portsHtml = n.type === 'has-role' ? 
      '<div class="flex items-center justify-between text-emerald-400"><span class="text-[11px]">Đúng (Yes)</span><div class="node-port bg-emerald-500" data-port="yes" data-node="' + n.id + '" title="Kéo nối nhánh Đúng"></div></div>' +
      '<div class="flex items-center justify-between text-rose-400"><span class="text-[11px]">Sai (No)</span><div class="node-port bg-rose-500" data-port="no" data-node="' + n.id + '" title="Kéo nối nhánh Sai"></div></div>'
      : '<div class="flex items-center justify-between text-indigo-400"><span class="text-[11px]">Tiếp theo (Next)</span><div class="node-port bg-indigo-500" data-port="next" data-node="' + n.id + '" title="Kéo nối khối tiếp theo"></div></div>';

    nodeEl.innerHTML = 
      '<div class="px-3.5 py-2.5 bg-slate-800/50 border-b border-slate-800/80 rounded-t-xl flex items-center justify-between cursor-move handle">' +
        '<div class="flex items-center gap-2">' +
          '<span class="p-1.5 rounded-lg ' + meta.badge + '"><i class="bi ' + meta.icon + '"></i></span>' +
          '<span class="font-bold text-xs text-slate-200">' + meta.title + '</span>' +
        '</div>' +
        '<button data-delete-node="' + esc(n.id) + '" class="text-slate-500 hover:text-rose-400 transition-colors"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="p-3.5 space-y-2.5 flex-1 cursor-default">' + fields + '</div>' +
      '<div class="px-3.5 py-2 bg-slate-950/40 border-t border-slate-800/60 rounded-b-xl flex flex-col gap-1.5 text-xs">' + portsHtml + '</div>';

    const handle = nodeEl.querySelector('.handle');
    nodeEl.querySelector('[data-delete-node]').addEventListener('click', () => deleteNode(n.id));
    const messageInput = nodeEl.querySelector('textarea[data-message-node]');
    if (messageInput) {
      messageInput.addEventListener('input', () => updateMessageSuggestions(i, messageInput));
      messageInput.addEventListener('keydown', event => handleMessageKeydown(event, i, messageInput));
    }
    handle.addEventListener('mousedown', (e) => {
      draggingNode = n;
      dragOffset = { x: e.clientX - n.x, y: e.clientY - n.y };
      e.stopPropagation();
    });

    container.appendChild(nodeEl);
  });

  document.querySelectorAll('.node-port').forEach(port => {
    port.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const fromNode = port.getAttribute('data-node');
      const portType = port.getAttribute('data-port');
      activeConnection = { fromNode, portType, startX: e.clientX, startY: e.clientY };
    });
  });

  drawConnections();
}

function drawConnections() {
  const svg = $('connections-svg');
  svg.innerHTML = '';
  const containerRect = $('canvas-container').getBoundingClientRect();

  nodes.forEach(n => {
    const targets = [];
    if (n.type === 'has-role') {
      if (n.data?.yes) targets.push({ targetId: n.data.yes, color: '#10b981', port: 'yes' });
      if (n.data?.no) targets.push({ targetId: n.data.no, color: '#f43f5e', port: 'no' });
    } else {
      if (n.next) targets.push({ targetId: n.next, color: '#6366f1', port: 'next' });
    }

    targets.forEach(t => {
      const fromEl = document.querySelector('#node-element-' + n.id + ' [data-port="' + t.port + '"]');
      const toEl = document.querySelector('#node-element-' + t.targetId);
      if (!fromEl || !toEl) return;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const startX = fromRect.left + fromRect.width / 2 - containerRect.left;
      const startY = fromRect.top + fromRect.height / 2 - containerRect.top;
      const endX = toRect.left + toRect.width / 2 - containerRect.left;
      const endY = toRect.top - containerRect.top;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const deltaY = Math.abs(endY - startY) * 0.5;
      const d = 'M ' + startX + ' ' + startY + ' C ' + startX + ' ' + (startY + deltaY) + ', ' + endX + ' ' + (endY - deltaY) + ', ' + endX + ' ' + endY;
      
      path.setAttribute('d', d);
      path.setAttribute('stroke', t.color);
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'transition-all opacity-80 hover:opacity-100');
      
      path.style.cursor = 'pointer';
      path.addEventListener('click', () => {
        if (t.port === 'next') delete n.next;
        if (t.port === 'yes') delete n.data.yes;
        if (t.port === 'no') delete n.data.no;
        renderGraph();
      });

      svg.appendChild(path);
    });
  });
}

window.addEventListener('mousemove', (e) => {
  if (draggingNode) {
    draggingNode.x = Math.max(10, e.clientX - dragOffset.x);
    draggingNode.y = Math.max(10, e.clientY - dragOffset.y);
    const el = document.getElementById('node-element-' + draggingNode.id);
    if (el) {
      el.style.left = draggingNode.x + 'px';
      el.style.top = draggingNode.y + 'px';
    }
    drawConnections();
  }

  if (activeConnection) {
    const svg = $('connections-svg');
    let tempPath = $('temp-path');
    if (!tempPath) {
      tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.id = 'temp-path';
      tempPath.setAttribute('stroke', '#a855f7');
      tempPath.setAttribute('stroke-width', '2');
      tempPath.setAttribute('stroke-dasharray', '4');
      tempPath.setAttribute('fill', 'none');
      svg.appendChild(tempPath);
    }
    const containerRect = $('canvas-container').getBoundingClientRect();
    const startX = activeConnection.startX - containerRect.left;
    const startY = activeConnection.startY - containerRect.top;
    const endX = e.clientX - containerRect.left;
    const endY = e.clientY - containerRect.top;

    tempPath.setAttribute('d', 'M ' + startX + ' ' + startY + ' L ' + endX + ' ' + endY);
  }
});

window.addEventListener('mouseup', (e) => {
  if (draggingNode) draggingNode = null;
  
  if (activeConnection) {
    const tempPath = $('temp-path');
    if (tempPath) tempPath.remove();

    const targetNodeEl = e.target.closest('[id^="node-element-"]');
    if (targetNodeEl) {
      const targetId = targetNodeEl.id.replace('node-element-', '');
      if (targetId !== activeConnection.fromNode) {
        const sourceNode = nodes.find(n => n.id === activeConnection.fromNode);
        if (sourceNode) {
          if (activeConnection.portType === 'next') sourceNode.next = targetId;
          if (activeConnection.portType === 'yes') sourceNode.data.yes = targetId;
          if (activeConnection.portType === 'no') sourceNode.data.no = targetId;
        }
      }
    }
    activeConnection = null;
    renderGraph();
  }
});

async function save() {
  $('status').textContent = 'Đang lưu...';
  const r = await fetch('/guildcommand/api/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token, password, guildId,
      name: $('name').value,
      description: $('description').value,
      enabled: $('enabled').checked,
      options,
      graph: nodes
    })
  });
  
  let d = await r.json();
  if (r.ok) {
    $('status').textContent = 'Đã lưu & đăng ký thành công!';
  } else {
    $('status').textContent = 'Lỗi: ' + d.error;
  }
}

init();
</script>
</body>
</html>`;

		res.type("html").send(html);
	});

	router.get("/guildcommand/api/meta", async (req, res) => {
		const session = getSession(req, res); if (!session) return;
		try {
			const record = await useHooks.get("db").ZiGuildCommand.findOne({ guildId: session.guildId, name: session.name });
			const guild = client.guilds.cache.get(session.guildId); if (!guild) return res.status(404).json({ error: "Bot không còn trong server." });
			await guild.channels.fetch().catch(() => {}); await guild.roles.fetch().catch(() => {}); await guild.members.fetch({ limit: 1000 }).catch(() => {});
			res.json({ name: session.name, record, guild: { channels: guild.channels.cache.filter(c => c.isTextBased() && c.guildId).map(c => ({id:c.id,name:'#'+c.name})), roles: guild.roles.cache.map(r => ({id:r.id,name:r.name})), members: guild.members.cache.filter(m => !m.user.bot).map(m => ({id:m.id,name:m.displayName+' (@'+m.user.username+')'})) } });
		} catch (e) { res.status(500).json({ error: e.message }); }
	});

	router.post("/guildcommand/api/save", express.json(), async (req, res) => {
		const session = getSession(req, res); if (!session) return;
		try {
			const { name, description, enabled, options, graph } = req.body;
			if (name !== session.name) return res.status(400).json({error:"Tên lệnh không khớp với link."});
			const nv = await manager.execute({action:"validateCommandName",name}); if (!nv.ok) return res.status(400).json({error:nv.error});
			const dv = await manager.execute({action:"validateDescription",description}); if (!dv.ok) return res.status(400).json({error:dv.error});
			if (!Array.isArray(options)||options.length>25||!Array.isArray(graph)||graph.length>100) return res.status(400).json({error:"Options hoặc graph không hợp lệ."});
			const allowed=new Set(["String","User","Channel","Role","Boolean","Option"]); const seen=new Set(), seenOptionIds=new Set();
			for(const o of options){o.id ||= crypto.randomUUID(); if(!/^[a-z0-9_-]{1,32}$/.test(o.name)||seen.has(o.name)||!allowed.has(o.type)||seenOptionIds.has(o.id))return res.status(400).json({error:"Tên, ID hoặc kiểu option không hợp lệ."});seen.add(o.name);seenOptionIds.add(o.id);if(o.type==='Option'&&(!Array.isArray(o.choices)||!o.choices.length||o.choices.length>25))return res.status(400).json({error:'Option cần từ 1 đến 25 lựa chọn.'});}
			const ids=new Set(graph.map(n=>n.id));if(graph.some(n=>!ids.has(n.next)&&n.next||n.type==='has-role'&&(!ids.has(n.yes||n.data?.yes)&&(n.yes||n.data?.yes)||!ids.has(n.no||n.data?.no)&&(n.no||n.data?.no))))return res.status(400).json({error:'Liên kết khối không hợp lệ.'});
			
			const cleanGraph = graph.map(n => ({
				id: n.id,
				type: n.type,
				data: n.data || {},
				next: n.next || null,
				yes: n.type === 'has-role' ? (n.data?.yes || n.yes || null) : undefined,
				no: n.type === 'has-role' ? (n.data?.no || n.no || null) : undefined,
				x: n.x, y: n.y
			}));

			const db=useHooks.get('db'),old=await db.ZiGuildCommand.findOne({guildId:session.guildId,name});
			if(!old){const count=await manager.execute({action:'getGuildCommandCount',guildId:session.guildId});if(count>=25)return res.status(400).json({error:'Server đã đạt giới hạn lệnh.'});}
			const record=old?await db.ZiGuildCommand.findOneAndUpdate({guildId:session.guildId,name},{$set:{description,type:'graph',response:{options,graph:cleanGraph},target:null,enabled:!!enabled}}):await db.ZiGuildCommand.create({guildId:session.guildId,name,description,type:'graph',response:{options,graph:cleanGraph},enabled:!!enabled,createdBy:session.userId});
			await manager.execute({action:'syncToCache',record}); await manager.execute({action:'deployGuildCommands',client,guildId:session.guildId}); sessions.delete(req.body.token); res.json({success:true});
		} catch(e){useHooks.get('logger')?.error?.('[GuildCommand Web] '+e.stack);res.status(500).json({error:e.message});}
	});

	useHooks.get("server").use(router);
};
