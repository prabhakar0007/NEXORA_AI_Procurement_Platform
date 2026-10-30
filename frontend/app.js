let suppliers = [], rfqs = [], mapInstance = null;
const $ = s => document.querySelector(s);
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function toast(msg) {
  let t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

async function api(path, opts = {}) {
  let r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let d = await r.json();
  if (!r.ok) throw new Error(d.detail || 'Request failed');
  return d;
}

function updateHeaderDate() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const dateEl = $('#headerDate');
  if (dateEl) dateEl.textContent = dateStr;

  const hr = d.getHours();
  const greeting = hr < 12 ? 'Good morning, team' : hr < 18 ? 'Good afternoon, team' : 'Good evening, team';
  const title = $('#pageTitle');
  if (title && ($('#pageCrumb')?.textContent === 'Overview' || !$('#pageCrumb'))) {
    title.innerHTML = `${greeting} <span class="wave">✳</span>`;
  }
}

function renderChartDates() {
  const chartX = document.querySelector('.chart-x');
  if (!chartX) return;
  const d = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const pt = new Date(d);
    pt.setDate(d.getDate() - (i * 6));
    labels.push(pt.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }));
  }
  chartX.innerHTML = labels.map(l => `<span>${l}</span>`).join('');
}

async function load() {
  try {
    let [s, r, c] = await Promise.all([api('/api/suppliers'), api('/api/rfqs'), api('/api/config')]);
    suppliers = s;
    rfqs = r;
    
    if ($('#geminiState')) $('#geminiState').textContent = c.gemini_configured ? 'Connected' : 'Add key in .env';
    if ($('#mapsState')) $('#mapsState').textContent = c.maps_key ? 'Key configured' : 'Add key in .env';
    
    updateHeaderDate();
    renderChartDates();
    render();
    
    if (c.maps_key) {
      loadMaps(c.maps_key);
    } else {
      let m = $('#map');
      if (m) m.innerHTML = '<div class="empty-state"><h3>Google Maps key not configured</h3><p>Add GOOGLE_MAPS_API_KEY to .env and restart the server.</p></div>';
    }
  } catch (e) {
    toast(e.message);
  }
}

function render() {
  if ($('#metricSuppliers')) $('#metricSuppliers').textContent = String(suppliers.length).padStart(2, '0');
  if ($('#supplierNavCount')) $('#supplierNavCount').textContent = String(suppliers.length).padStart(2, '0');
  if ($('#metricRfqs')) $('#metricRfqs').textContent = String(rfqs.length).padStart(2, '0');
  if ($('#ctxSuppliers')) $('#ctxSuppliers').textContent = suppliers.length;
  if ($('#ctxRfqs')) $('#ctxRfqs').textContent = rfqs.length;

  let avg = suppliers.length ? suppliers.reduce((a, s) => a + Number(s.lead_days), 0) / suppliers.length : 0;
  if ($('#metricLead')) $('#metricLead').innerHTML = avg.toFixed(1) + ' <small>days</small>';

  // Dynamic potential savings calculation
  if ($('#metricSavings')) {
    if (suppliers.length > 1) {
      let prices = suppliers.map(s => Number(s.price));
      let minPrice = Math.min(...prices);
      let avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      let spread = avgPrice - minPrice;
      let totalQty = rfqs.length ? rfqs.reduce((a, r) => a + Number(r.quantity), 0) : 10000;
      let savings = Math.max(0, spread * totalQty);
      $('#metricSavings').textContent = money(Math.round(savings));
    } else {
      $('#metricSavings').textContent = money(0);
    }
  }

  let ranked = [...suppliers].sort((a, b) => (b.quality + b.reliability) - (a.quality + a.reliability)).slice(0, 4);
  if ($('#topSuppliers')) {
    $('#topSuppliers').innerHTML = ranked.map((s, i) => `
      <div class="rank-row">
        <div class="rank-no">${i + 1}</div>
        <div class="rank-info">
          <b>${esc(s.name)}</b>
          <small>${esc(s.location || '')}</small>
        </div>
        <span class="score">${Math.round((s.quality + s.reliability) / 2)}%</span>
      </div>
    `).join('') || '<p class="helper">No supplier records yet.</p>';
  }

  if ($('#supplierRows')) {
    $('#supplierRows').innerHTML = suppliers.map(s => `
      <tr>
        <td>
          <div class="supplier-name">
            <span class="supplier-symbol">◈</span>
            <b>${esc(s.name)}</b>
          </div>
        </td>
        <td>${esc(s.location)}</td>
        <td>${money(s.price)}</td>
        <td><span class="scorebar"><i style="width:${s.quality}%"></i></span>${s.quality}%</td>
        <td>${s.reliability}%</td>
        <td>${s.lead_days} days</td>
        <td><button class="delete-btn" data-delete="${s.id}">Delete</button></td>
      </tr>
    `).join('');
  }

  if ($('#rfqList')) {
    $('#rfqList').innerHTML = rfqs.map(r => `
      <article class="rfq-card">
        <div class="rfq-card-head">
          <span class="status-chip live">OPEN RFQ</span>
          <button class="rfq-del-btn" data-delete-rfq="${r.id}" title="Delete RFQ">×</button>
        </div>
        <h3 style="margin-top:10px">${esc(r.title)}</h3>
        <p>Purchase requirement · #RFQ-${String(r.id).padStart(4, '0')}${r.deadline ? ' · Due ' + esc(r.deadline) : ''}</p>
        <div class="rfq-meta">
          <span>${Number(r.quantity).toLocaleString()} units</span>
          <b>${money(r.budget)}</b>
        </div>
        <div class="rfq-actions">
          <button class="rfq-opt-btn" data-opt-title="${esc(r.title)}" data-opt-qty="${r.quantity}" data-opt-budget="${r.budget}">✳ Run Smart Optimizer</button>
        </div>
      </article>
    `).join('') || '<div class="panel"><p class="helper">No RFQs yet. Create your first purchase requirement.</p></div>';
  }

  renderShipments();
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatMarkdown(text) {
  if (!text) return '';
  let safe = esc(text);
  // Headers
  safe = safe.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  safe = safe.replace(/^## (.*$)/gim, '<h4>$1</h4>');
  // Bold
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Inline code
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bullet points
  safe = safe.replace(/^\s*[\*\-]\s+(.*$)/gim, '<li>$1</li>');
  // Wrap list items
  safe = safe.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  safe = safe.replace(/<\/ul>\s*<ul>/g, '');
  // Line breaks
  safe = safe.replace(/\n\n/g, '<br><br>');
  safe = safe.replace(/\n/g, '<br>');
  return safe;
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  let target = $('#view-' + name);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));

  let titles = {
    overview: 'Overview',
    suppliers: 'Suppliers',
    rfq: 'RFQ & sourcing',
    optimizer: 'Smart optimizer',
    logistics: 'Logistics',
    intelligence: 'AI intelligence'
  };
  let title = titles[name] || 'Overview';
  if ($('#pageCrumb')) $('#pageCrumb').textContent = title;
  
  const d = new Date();
  const hr = d.getHours();
  const greeting = hr < 12 ? 'Good morning, team' : hr < 18 ? 'Good afternoon, team' : 'Good evening, team';
  
  if ($('#pageTitle')) $('#pageTitle').innerHTML = title === 'Overview' ? `${greeting} <span class="wave">✳</span>` : title;
  if ($('#pageSubtitle')) {
    $('#pageSubtitle').textContent = title === 'Overview'
      ? "Here's what's happening across your procurement operations."
      : 'Manage and analyze your procurement operations.';
  }

  let sb = $('#sidebar');
  if (sb) sb.classList.remove('open');
  if (name === 'logistics' && mapInstance && window.google?.maps) {
    google.maps.event.trigger(mapInstance, 'resize');
  }
}

document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showView(b.dataset.goto)));

if ($('#menuBtn')) $('#menuBtn').onclick = () => $('#sidebar')?.classList.toggle('open');

function openModal(type) {
  let isS = type === 'supplier';
  $('#modalTitle').textContent = isS ? 'Add supplier' : 'Create purchase requirement';
  $('#modalDesc').textContent = isS ? 'Add a supplier record to your workspace.' : 'Define what your business needs to purchase.';

  let fields = isS ? [
    ['name', 'Supplier name', 'text', 'Apex Components'],
    ['category', 'Category', 'text', 'Electronics'],
    ['location', 'Location', 'text', 'Pune, India'],
    ['price', 'Unit price (₹)', 'number', '42.5'],
    ['quality', 'Quality score (0–100)', 'number', '90'],
    ['reliability', 'Reliability (0–100)', 'number', '88'],
    ['lead_days', 'Lead time (days)', 'number', '7'],
    ['email', 'Contact email', 'email', 'supplier@company.com']
  ] : [
    ['title', 'Requirement title', 'text', 'Electronic components'],
    ['quantity', 'Quantity', 'number', '10000'],
    ['budget', 'Maximum budget (₹)', 'number', '500000'],
    ['deadline', 'Required by', 'date', '']
  ];

  $('#modalFields').innerHTML = fields.map(([id, label, t, ph]) => `
    <label class="${id === 'email' ? 'wide-field' : ''}">
      ${label}
      <input name="${id}" type="${t}" placeholder="${ph}" ${['name', 'title', 'quantity', 'budget', 'price'].includes(id) ? 'required' : ''}>
    </label>
  `).join('');

  $('#modal').classList.remove('hidden');
  $('#modalForm').dataset.type = type;
}

if ($('#addSupplierBtn')) $('#addSupplierBtn').onclick = () => openModal('supplier');
if ($('#newRfqBtn')) $('#newRfqBtn').onclick = () => openModal('rfq');
if ($('#rfqCreate2')) $('#rfqCreate2').onclick = () => openModal('rfq');
if ($('#closeModal')) $('#closeModal').onclick = () => $('#modal').classList.add('hidden');
if ($('#cancelModal')) $('#cancelModal').onclick = () => $('#modal').classList.add('hidden');

$('#modalForm').onsubmit = async e => {
  e.preventDefault();
  let data = Object.fromEntries(new FormData(e.target));
  try {
    if (e.target.dataset.type === 'supplier') {
      ['price', 'quality', 'reliability', 'lead_days'].forEach(k => data[k] = Number(data[k]));
      await api('/api/suppliers', { method: 'POST', body: JSON.stringify(data) });
      toast('Supplier added successfully');
    } else {
      data.quantity = Number(data.quantity);
      data.budget = Number(data.budget);
      await api('/api/rfqs', { method: 'POST', body: JSON.stringify(data) });
      toast('RFQ created successfully');
    }
    $('#modal').classList.add('hidden');
    await load();
  } catch (err) {
    toast(err.message);
  }
};

$('#supplierRows').addEventListener('click', async e => {
  let id = e.target.dataset.delete;
  if (id && confirm('Delete this supplier record?')) {
    try {
      await api('/api/suppliers/' + id, { method: 'DELETE' });
      await load();
      toast('Supplier deleted');
    } catch (x) {
      toast(x.message);
    }
  }
});

$('#rfqList').addEventListener('click', async e => {
  let delId = e.target.dataset.deleteRfq;
  if (delId && confirm('Delete this RFQ requirement?')) {
    try {
      await api('/api/rfqs/' + delId, { method: 'DELETE' });
      await load();
      toast('RFQ deleted successfully');
    } catch (x) {
      toast(x.message);
    }
    return;
  }

  let optBtn = e.target.closest('[data-opt-title]');
  if (optBtn) {
    let title = optBtn.dataset.optTitle;
    let qty = optBtn.dataset.optQty;
    let budget = optBtn.dataset.optBudget;
    if ($('#optProduct')) $('#optProduct').value = title;
    if ($('#optQty')) $('#optQty').value = qty;
    if ($('#optBudget')) $('#optBudget').value = budget;
    showView('optimizer');
    $('#runOptimizer')?.click();
  }
});

$('#supplierSearch').oninput = e => {
  let q = e.target.value.toLowerCase();
  document.querySelectorAll('#supplierRows tr').forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
};

$('#runOptimizer').onclick = () => {
  let prod = ($('#optProduct')?.value || 'Requirement').trim();
  let qty = Number($('#optQty').value), budget = Number($('#optBudget').value), days = Number($('#optDays').value);
  if (!qty || !budget || !days || qty < 1) {
    toast('Enter valid quantity, budget and delivery days');
    return;
  }
  let eligible = suppliers.filter(s => Number(s.lead_days) <= days).sort((a, b) => Number(a.price) - Number(b.price));
  let out = $('#optimizerResult');
  if (!eligible.length) {
    out.innerHTML = '<div class="empty-state"><h3>No feasible supplier found</h3><p>No saved supplier meets the delivery window. Add suppliers or relax the constraint.</p></div>';
    return;
  }

  let remaining = qty, allocations = [], spent = 0;
  for (let s of eligible) {
    if (!remaining) break;
    let take = remaining;
    let cost = take * Number(s.price);
    allocations.push({ s, qty: take, cost });
    spent += cost;
    remaining -= take;
  }
  let feasible = remaining === 0 && spent <= budget;

  out.innerHTML = `
    <h3>Optimization result for "${esc(prod)}"</h3>
    <p class="helper">Cost-optimized allocation among suppliers meeting your ${days}-day delivery window.</p>
    <div class="result-summary">
      <div class="result-kpi"><small>Estimated purchase cost</small><b>${money(spent)}</b></div>
      <div class="result-kpi"><small>Budget status</small><b style="font-size:14px;color:${feasible ? '#159568' : '#c27d39'}">${feasible ? 'Within budget' : 'Over budget / infeasible'}</b></div>
      <div class="result-kpi"><small>Quantity covered</small><b>${(qty - remaining).toLocaleString()} / ${qty.toLocaleString()}</b></div>
    </div>
    <div class="allocation-row head"><span>SUPPLIER</span><span>QUANTITY</span><span>LINE COST</span></div>
    ${allocations.map(a => `
      <div class="allocation-row">
        <b>${esc(a.s.name)}</b>
        <span>${a.qty.toLocaleString()}</span>
        <b>${money(a.cost)}</b>
      </div>
    `).join('')}
    <p class="helper">${remaining ? `Unallocated quantity: ${remaining}. ` : ''}Recommendation is calculated deterministically from saved quotes.</p>
    <button class="optimizer-ai-btn" id="analyzeOptAiBtn">
      <span>◉</span> Ask Gemini to evaluate this allocation & trade-offs
    </button>
  `;

  $('#analyzeOptAiBtn').onclick = () => {
    let p = `Please evaluate this supplier allocation for ${qty} units of "${prod}" with budget ${money(budget)} and ${days} days delivery window. Allocated to: ${allocations.map(a => `${a.s.name} (${a.qty} units @ ${money(a.cost)})`).join(', ')}. What are the risks, and what negotiation strategy do you recommend?`;
    showView('intelligence');
    let inp = $('#aiPrompt');
    if (inp) inp.value = p;
    $('#aiForm')?.requestSubmit();
  };
};

function renderShipments() {
  let list = $('#shipmentList');
  if (!list) return;
  list.innerHTML = suppliers.slice(0, 5).map(s => `
    <div class="shipment">
      <b>${esc(s.name)}</b>
      <small>Supplier record #${s.id} · simulated carrier event</small><br>
      <span class="status-chip demo">DEMO STATUS</span>
      <button class="text-btn" data-track="${s.id}">Generate status</button>
      <div id="track-${s.id}" class="helper"></div>
    </div>
  `).join('');
}

$('#shipmentList').addEventListener('click', async e => {
  let id = e.target.dataset.track;
  if (!id) return;
  try {
    let d = await api('/api/demo/logistics/' + id);
    $('#track-' + id).textContent = `${d.shipment_id}: ${d.status} · ETA ${d.estimated_days} days. ${d.notice}`;
  } catch (x) {
    toast(x.message);
  }
});

window.gm_authFailure = () => {
  let m = $('#map');
  if (m) {
    m.innerHTML = '<div class="empty-state"><h3>Google Maps API Key Notice</h3><p>Maps API key is not enabled for Maps JavaScript or Geocoding API. Check project configuration in Google Cloud Console.</p></div>';
  }
};

async function loadMaps(key) {
  window.initNexoraMap = () => {
    try {
      mapInstance = new google.maps.Map($('#map'), {
        center: { lat: 22.9734, lng: 78.6569 },
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }]
      });
      let geocoder = new google.maps.Geocoder();
      suppliers.forEach(s => {
        geocoder.geocode({ address: s.location + ', India' }, (res, status) => {
          if (status === 'OK' && res[0]) {
            new google.maps.Marker({
              map: mapInstance,
              position: res[0].geometry.location,
              title: s.name
            });
          }
        });
      });
    } catch (e) {
      $('#map').innerHTML = '<p class="helper">Map could not be initialized. Check your Maps API key and enabled APIs.</p>';
    }
  };

  if (window.google?.maps) {
    window.initNexoraMap();
    return;
  }
  let script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initNexoraMap`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    $('#map').innerHTML = '<div class="empty-state"><h3>Maps could not load</h3><p>Check API key restrictions, billing and Maps JavaScript API enablement.</p></div>';
  };
  document.head.appendChild(script);
}

$('#aiForm').onsubmit = async e => {
  e.preventDefault();
  let inp = $('#aiPrompt');
  let btn = $('#aiForm .send-btn');
  let p = inp.value.trim();
  if (!p) return;

  addBubble(p, 'user');
  inp.value = '';
  inp.disabled = true;
  if (btn) btn.disabled = true;

  let wait = addBubble('<span class="typing-dots"><span></span><span></span><span></span></span> Thinking with Gemini…', 'assistant', true);

  try {
    let d = await api('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ prompt: p, context: { suppliers, rfqs } })
    });
    wait.innerHTML = formatMarkdown(d.answer);
  } catch (err) {
    wait.innerHTML = `<span style="color:#e05252">AI request could not be completed: ${esc(err.message)}</span>`;
  } finally {
    inp.disabled = false;
    if (btn) btn.disabled = false;
    inp.focus();
    let box = $('#chatMessages');
    if (box) box.scrollTop = box.scrollHeight;
  }
};

function addBubble(t, role, isHtml = false) {
  let b = document.createElement('div');
  b.className = 'chat-bubble ' + role;
  if (isHtml) {
    b.innerHTML = t;
  } else {
    b.textContent = t;
  }
  let box = $('#chatMessages');
  box.appendChild(b);
  box.scrollTop = box.scrollHeight;
  return b;
}

document.querySelectorAll('[data-prompt]').forEach(b => {
  b.onclick = () => {
    $('#aiPrompt').value = b.dataset.prompt;
    $('#aiForm').requestSubmit();
  };
});

if ($('#clearChatBtn')) {
  $('#clearChatBtn').onclick = () => {
    let box = $('#chatMessages');
    if (box) {
      box.innerHTML = `<div class="chat-bubble assistant">Hello! I’m NEXORA. I can compare supplier options, explain trade-offs, identify missing information and help plan sourcing decisions. What would you like to analyze?</div>`;
    }
  };
}

load();
