frappe.provide('hqs');

$(document).on('page-change', function () {
    if (frappe.get_route_str() === 'Workspaces/Triage') {
        setTimeout(initTriageWidget, 800);
    }
});

function initTriageWidget() {
    if (document.getElementById('triage-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'triage-widget';
    widget.innerHTML = `
        <style>
            #triage-widget { padding: 20px 0; font-family: 'Segoe UI', sans-serif; }
            .tw-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
            .tw-stat { background: white; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 4px solid #2B5BA8; }
            .tw-stat.green  { border-color: #6AAC2B; }
            .tw-stat.orange { border-color: #E65100; }
            .tw-stat.grey   { border-color: #aaa; }
            .tw-stat-value  { font-size: 2rem; font-weight: 900; color: #222; line-height: 1; }
            .tw-stat-label  { font-size: 0.72rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
            .tw-section-title { font-size: 1rem; font-weight: 700; color: #333; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
            .tw-updated { font-size: 0.72rem; color: #aaa; font-weight: 400; }
            .tw-doctor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
            .tw-doc-card { border-radius: 12px; padding: 16px; background: #f0f4ff; border-top: 5px solid #2B5BA8; text-align: center; }
            .tw-doc-card.on-break { border-top-color: #E65100; background: #fff8f0; }
            .tw-room-label { font-size: 0.68rem; color: #999; text-transform: uppercase; letter-spacing: 1px; }
            .tw-room-name  { font-size: 1.4rem; font-weight: 900; color: #2B5BA8; line-height: 1.1; margin-bottom: 4px; }
            .tw-doc-card.on-break .tw-room-name { color: #E65100; }
            .tw-counter    { font-size: 0.72rem; background: #dce8ff; color: #2B5BA8; border-radius: 20px; padding: 2px 10px; display: inline-block; margin-bottom: 6px; font-weight: 700; }
            .tw-doc-name   { font-size: 0.85rem; font-weight: 600; color: #444; margin-bottom: 6px; }
            .tw-status-tag { font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
            .tw-active { background: #e8f5e9; color: #2e7d32; }
            .tw-break  { background: #fff3e0; color: #E65100; }
            .tw-no-data { color: #bbb; font-size: 0.9rem; padding: 20px 0; }
        </style>

        <!-- STATS ROW -->
        <div class="tw-stats">
            <div class="tw-stat orange">
                <div class="tw-stat-value" id="tw-waiting-reception">--</div>
                <div class="tw-stat-label">Waiting at Reception</div>
            </div>
            <div class="tw-stat">
                <div class="tw-stat-value" id="tw-waiting-triage">--</div>
                <div class="tw-stat-label">Queued for Triage</div>
            </div>
            <div class="tw-stat green">
                <div class="tw-stat-value" id="tw-served">--</div>
                <div class="tw-stat-label">Served Today</div>
            </div>
            <div class="tw-stat grey">
                <div class="tw-stat-value" id="tw-avg">--</div>
                <div class="tw-stat-label">Avg Wait (min)</div>
            </div>
        </div>

        <!-- DOCTORS ON DUTY -->
        <div class="tw-section-title">
            Doctors ON Duty
            <span class="tw-updated" id="tw-updated">Loading...</span>
        </div>
        <div class="tw-doctor-grid" id="tw-doctor-grid">
            <div class="tw-no-data">Loading...</div>
        </div>
    `;

    const layout = document.querySelector('.layout-main-section');
    if (layout) layout.prepend(widget);

    loadTriageStats();
    loadDoctors();
    setInterval(loadTriageStats, 15000);
    setInterval(loadDoctors, 30000);
}

function loadTriageStats() {
    // Use frappe.call for all stats — more reliable in Frappe 17
    frappe.call({
        method: 'hqs.hqs.api.get_triage_stats',
        callback: function(r) {
            if (!r.message) return;
            const m = r.message;
            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val ?? '--';
            };
            set('tw-waiting-reception', m.waiting_reception);
            set('tw-waiting-triage', m.waiting_triage);
            set('tw-served', m.served);
            set('tw-avg', m.avg_time);
        }
    });
}

function loadDoctors() {
    frappe.call({
        method: 'hqs.hqs.api.get_active_doctors',
        callback: function(r) {
            const grid = document.getElementById('tw-doctor-grid');
            const updated = document.getElementById('tw-updated');
            if (!grid) return;

            if (updated) updated.textContent = 'Updated: ' + new Date().toLocaleTimeString();

            const doctors = r.message;
            if (!doctors || doctors.length === 0) {
                grid.innerHTML = '<div class="tw-no-data">No doctors currently on duty</div>';
                return;
            }

            grid.innerHTML = doctors.map(d => `
                <div class="tw-doc-card ${d.status === 'On Break' ? 'on-break' : ''}">
                    <div class="tw-room-label">Room</div>
                    <div class="tw-room-name">${d.room || '—'}</div>
                    ${d.counter ? `<div class="tw-counter">📍 ${d.counter}</div>` : ''}
                    <div class="tw-doc-name">${d.doctor_name}</div>
                    <span class="tw-status-tag ${d.status === 'On Break' ? 'tw-break' : 'tw-active'}">
                        ${d.status === 'On Break' ? '☕ On Break' : '✅ Active'}
                    </span>
                </div>
            `).join('');
        }
    });
}