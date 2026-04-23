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

    loadDoctors();
    setInterval(loadDoctors, 30000);
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