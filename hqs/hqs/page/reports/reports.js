frappe.pages["reports"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "HQS Reports",
		single_column: true,
	});
	const report = new HQSReports(page);
	report.init();
};

class HQSReports {
	constructor(page) {
		this.page = page;
		this.all_data = [];   // full dataset for KPIs + charts
		this.table_data = []; // filtered dataset for table only
		this.table_filters = {
			from_date: frappe.datetime.add_days(frappe.datetime.get_today(), -30),
			to_date: frappe.datetime.get_today(),
			from_room: "",
			to_room: "",
			status: "",
			turnaround_range: "",
		};
	}

	init() {
		this.inject_html();
		this.setup_page_actions();
		this.load_rooms();
		this.load_data();
	}

	setup_page_actions() {
		this.page.set_primary_action("Refresh", () => this.load_data(), "refresh");
		this.page.add_menu_item("Export CSV", () => this.export_csv());
	}

	// ── HTML ──────────────────────────────────────────────────────────────────
	inject_html() {
		$(this.page.main).html(`
			<div class="hqs-reports-page">

				<!-- KPI CARDS -->
				<div class="hqs-kpi-row">
					<div class="hqs-kpi-card" data-kpi="total">
						<div class="hqs-kpi-icon"><i class="fa fa-users"></i></div>
						<div><div class="hqs-kpi-value">–</div><div class="hqs-kpi-label">Total Visits</div></div>
					</div>
					<div class="hqs-kpi-card" data-kpi="avg-time">
						<div class="hqs-kpi-icon"><i class="fa fa-hourglass-half"></i></div>
						<div><div class="hqs-kpi-value">–</div><div class="hqs-kpi-label">Avg Turnaround</div></div>
					</div>
					<div class="hqs-kpi-card" data-kpi="urgent">
						<div class="hqs-kpi-icon"><i class="fa fa-exclamation-circle"></i></div>
						<div><div class="hqs-kpi-value">–</div><div class="hqs-kpi-label">Urgent Cases</div></div>
					</div>
					<div class="hqs-kpi-card" data-kpi="emergency">
						<div class="hqs-kpi-icon"><i class="fa fa-ambulance"></i></div>
						<div><div class="hqs-kpi-value">–</div><div class="hqs-kpi-label">Emergency Cases</div></div>
					</div>
				</div>

				<!-- CHARTS ROW -->
				<div class="hqs-charts-row">
					<div class="hqs-card">
						<div class="hqs-card-header">
							<span>Visits per Room</span>
							<div class="hqs-inline-filters">
								<div class="hqs-inline-group">
									<label>From</label>
									<input type="date" id="rc-from-date" value="">
								</div>
								<div class="hqs-inline-group">
									<label>To</label>
									<input type="date" id="rc-to-date" value="">
								</div>
								<button class="hqs-inline-btn" id="rc-apply">Apply</button>
							</div>
						</div>
						<div id="hqs-room-chart" style="min-height:240px;"></div>
					</div>
					<div class="hqs-card">
						<div class="hqs-card-header"><span>Avg Turnaround per Room (min)</span></div>
						<div id="hqs-time-chart" style="min-height:240px;"></div>
					</div>
				</div>

				<!-- DAILY CHART FULL WIDTH -->
				<div class="hqs-card">
					<div class="hqs-card-header">
						<span>Daily Arrivals</span>
						<span class="hqs-badge" id="hqs-period-label"></span>
					</div>
					<div id="hqs-daily-chart" style="min-height:220px;"></div>
				</div>

				<!-- PEAK HOURS HEATMAP -->
				<div class="hqs-card">
					<div class="hqs-card-header"><span>Peak Hours Heatmap</span>
						<span style="font-size:11px;color:#6db8f7;font-weight:400">Patients per hour of day vs day of week</span>
					</div>
					<div id="hqs-heatmap" style="padding:16px;overflow-x:auto;"></div>
				</div>

				<!-- COUNTER PERFORMANCE -->
				<div class="hqs-card">
					<div class="hqs-card-header"><span>Counter Performance</span></div>
					<div id="hqs-counter-chart" style="min-height:240px;"></div>
				</div>

				<!-- PATIENT JOURNEY TABLE WITH EMBEDDED FILTERS -->
				<div class="hqs-card">
					<div class="hqs-card-header">
						<span>Patient Journey Records</span>
						<span class="hqs-record-count" id="hqs-record-count"></span>
					</div>

					<!-- TABLE FILTER BAR -->
					<div class="hqs-table-filters">
						<div class="hqs-fg">
							<label>From Date</label>
							<input type="date" id="tf-from-date" value="${this.table_filters.from_date}">
						</div>
						<div class="hqs-fg">
							<label>To Date</label>
							<input type="date" id="tf-to-date" value="${this.table_filters.to_date}">
						</div>
						<div class="hqs-journey-wrap">
							<div class="hqs-fg">
								<label>From Room</label>
								<select id="tf-from-room"><option value="">All Rooms</option></select>
							</div>
							<span class="hqs-arrow">→</span>
							<div class="hqs-fg">
								<label>To Room</label>
								<select id="tf-to-room"><option value="">All Rooms</option></select>
							</div>
						</div>
						<div class="hqs-fg">
							<label>Status</label>
							<select id="tf-status">
								<option value="">All</option>
								<option>Waiting</option>
								<option>Called</option>
								<option>Serving</option>
								<option>Done</option>
								<option>No Show</option>
							</select>
						</div>
						<div class="hqs-fg" style="min-width:140px">
							<label>Turnaround Time</label>
							<select id="tf-turnaround">
								<option value="">Any Duration</option>
								<option value="0-10">Under 10 min</option>
								<option value="10-30">10 – 30 min</option>
								<option value="30-60">30 – 60 min</option>
								<option value="60-999">Over 60 min</option>
							</select>
						</div>
						<div class="hqs-fg hqs-filter-btns">
							<label>&nbsp;</label>
							<div style="display:flex;gap:6px">
								<button class="hqs-btn-apply" id="tf-apply">
									<i class="fa fa-filter"></i> Apply
								</button>
								<button class="hqs-btn-clear" id="tf-clear">Clear</button>
							</div>
						</div>
					</div>

					<!-- ACTIVE CHIPS -->
					<div id="hqs-chips-row" style="display:none;padding:8px 16px;border-bottom:1px solid #e8f4fd;display:flex;flex-wrap:wrap;align-items:center;gap:6px">
						<span style="font-size:11px;font-weight:600;color:#6db8f7;text-transform:uppercase;letter-spacing:.04em">Filtered:</span>
						<div id="hqs-chips" style="display:flex;flex-wrap:wrap;gap:5px"></div>
						<span id="hqs-chips-count" style="font-size:12px;color:#2490EF;font-weight:600;margin-left:2px"></span>
					</div>

					<div id="hqs-datatable" class="hqs-datatable-wrap"></div>
				</div>

				<div id="hqs-loading" class="hqs-loading-overlay" style="display:none;">
					<div class="hqs-spinner"></div><span>Loading…</span>
				</div>
			</div>
		`);

		this.inject_styles();
		frappe.pages["reports"]._report = this;

		document.getElementById("tf-apply").addEventListener("click", () => this.apply_table_filters());
		document.getElementById("tf-clear").addEventListener("click", () => this.clear_table_filters());
		// Room chart filter applied after HTML renders
		setTimeout(() => {
			const btn = document.getElementById("rc-apply");
			if (btn) btn.addEventListener("click", () => this.apply_room_chart_filter());
		}, 500);
	}

	// ── ROOMS ─────────────────────────────────────────────────────────────────
	load_rooms() {
		frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "QMS Room", fields: ["name"], limit: 100, order_by: "name asc" },
			callback: (r) => {
				if (!r.message) return;
				const opts = r.message.map(row => `<option value="${row.name}">${row.name}</option>`).join("");
				["tf-from-room", "tf-to-room"].forEach(id => {
					const el = document.getElementById(id);
					if (el) el.innerHTML = `<option value="">All Rooms</option>${opts}`;
				});
			},
		});
	}

	// ── LOAD ALL DATA (for KPIs + charts, last 30 days) ──────────────────────
	load_data() {
		this.show_loading(true);
		const from = frappe.datetime.add_days(frappe.datetime.get_today(), -30);
		const to   = frappe.datetime.get_today();

		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Queue Entry",
				filters: [
					["enqueued_at", ">=", from + " 00:00:00"],
					["enqueued_at", "<=", to + " 23:59:59"],
				],
				fields: ["name","token_number","patient","room","previous_room",
					"status","priority","enqueued_at","called_at","served_at","counter"],
				limit: 5000,
				order_by: "enqueued_at desc",
			},
			callback: (r) => {
				this.show_loading(false);
				this.all_data = r.message || [];
				this.table_data = [...this.all_data];
				this.render_kpis(this.all_data);
				this.render_room_chart(this.all_data);
				this.render_time_chart(this.all_data);
				this.render_daily_chart(this.all_data, from, to);
				this.render_table(this.table_data);
				this.render_heatmap(this.all_data);
				this.render_counter_chart(this.all_data);
				$("#hqs-period-label").text("Last 30 days");
				// Set default dates for room chart filter
				const rcFrom = document.getElementById("rc-from-date");
				const rcTo   = document.getElementById("rc-to-date");
				if (rcFrom) rcFrom.value = from;
				if (rcTo)   rcTo.value   = to;
			},
			error: () => {
				this.show_loading(false);
				frappe.msgprint({ title: "Error", message: "Could not load Queue Entry data.", indicator: "red" });
			},
		});
	}

	// ── TABLE FILTER ACTIONS ──────────────────────────────────────────────────
	read_table_filters() {
		this.table_filters.from_date        = document.getElementById("tf-from-date")?.value || "";
		this.table_filters.to_date          = document.getElementById("tf-to-date")?.value   || "";
		this.table_filters.from_room        = document.getElementById("tf-from-room")?.value || "";
		this.table_filters.to_room          = document.getElementById("tf-to-room")?.value   || "";
		this.table_filters.status           = document.getElementById("tf-status")?.value    || "";
		this.table_filters.turnaround_range = document.getElementById("tf-turnaround")?.value || "";
	}

	apply_table_filters() {
		this.read_table_filters();
		const f = this.table_filters;

		// If date range changed, reload from DB
		const default_from = frappe.datetime.add_days(frappe.datetime.get_today(), -30);
		const default_to   = frappe.datetime.get_today();
		if (f.from_date !== default_from || f.to_date !== default_to) {
			this.load_table_data();
			return;
		}

		this.table_data = this.filter_data(this.all_data);
		this.render_table(this.table_data);
		this.render_chips();
	}

	load_table_data() {
		this.show_loading(true);
		const f = this.table_filters;
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Queue Entry",
				filters: [
					["enqueued_at", ">=", f.from_date + " 00:00:00"],
					["enqueued_at", "<=", f.to_date + " 23:59:59"],
				],
				fields: ["name","token_number","patient","room","previous_room",
					"status","priority","enqueued_at","called_at","served_at","counter"],
				limit: 5000,
				order_by: "enqueued_at desc",
			},
			callback: (r) => {
				this.show_loading(false);
				const data = r.message || [];
				this.table_data = this.filter_data(data);
				this.render_table(this.table_data);
				this.render_chips();
			},
			error: () => { this.show_loading(false); }
		});
	}

	filter_data(data) {
		const f = this.table_filters;
		return data.filter(d => {
			if (f.from_room && d.previous_room !== f.from_room) return false;
			if (f.to_room   && d.room !== f.to_room)            return false;
			if (f.status    && d.status !== f.status)           return false;
			if (f.turnaround_range) {
				const [min, max] = f.turnaround_range.split("-").map(Number);
				if (!d.enqueued_at || !d.served_at) return false;
				const mins = Math.round((new Date(d.served_at) - new Date(d.enqueued_at)) / 60000);
				if (mins < min || mins > max) return false;
			}
			return true;
		});
	}

	clear_table_filters() {
		["tf-from-room","tf-to-room","tf-status","tf-turnaround"].forEach(id => {
			const el = document.getElementById(id);
			if (el) el.value = "";
		});
		const df = frappe.datetime.add_days(frappe.datetime.get_today(), -30);
		const dt = frappe.datetime.get_today();
		const fd = document.getElementById("tf-from-date");
		const td = document.getElementById("tf-to-date");
		if (fd) fd.value = df;
		if (td) td.value = dt;

		this.table_filters = { from_date: df, to_date: dt, from_room:"", to_room:"", status:"", turnaround_range:"" };
		this.table_data = [...this.all_data];
		this.render_table(this.table_data);
		this.render_chips();
	}

	// ── CHIPS ─────────────────────────────────────────────────────────────────
	render_chips() {
		const f = this.table_filters;
		const chips = [];
		if (f.from_room) chips.push(`From: ${f.from_room}`);
		if (f.to_room)   chips.push(`To: ${f.to_room}`);
		if (f.status)    chips.push(`Status: ${f.status}`);
		if (f.turnaround_range) {
			const labels = {"0-10":"< 10 min","10-30":"10–30 min","30-60":"30–60 min","60-999":"> 60 min"};
			chips.push(`Duration: ${labels[f.turnaround_range]}`);
		}
		const row   = document.getElementById("hqs-chips-row");
		const el    = document.getElementById("hqs-chips");
		const count = document.getElementById("hqs-chips-count");
		if (!chips.length) { row.style.display = "none"; return; }
		row.style.display = "flex";
		el.innerHTML = chips.map(c => `<span class="hqs-chip">${c}</span>`).join("");
		count.textContent = `— ${this.table_data.length.toLocaleString()} of ${this.all_data.length.toLocaleString()} records`;
	}

	// ── KPIs ─────────────────────────────────────────────────────────────────
	render_kpis(data) {
		const total     = data.length;
		const urgent    = data.filter(d => d.priority === "Urgent").length;
		const emergency = data.filter(d => d.priority === "Emergency").length;
		const times = data
			.filter(d => d.enqueued_at && d.served_at)
			.map(d => (new Date(d.served_at) - new Date(d.enqueued_at)) / 60000)
			.filter(t => t > 0 && t < 600);
		const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
		this.set_kpi("total",     total.toLocaleString());
		this.set_kpi("avg-time",  avg !== null ? avg + " min" : "N/A");
		this.set_kpi("urgent",    urgent.toLocaleString());
		this.set_kpi("emergency", emergency.toLocaleString());
	}

	set_kpi(key, value) {
		$(`.hqs-kpi-card[data-kpi="${key}"] .hqs-kpi-value`).text(value);
	}

	// ── ROOM CHART FILTER ────────────────────────────────────────────────────
	apply_room_chart_filter() {
		const from = document.getElementById("rc-from-date")?.value;
		const to   = document.getElementById("rc-to-date")?.value;
		if (!from || !to) { this.render_room_chart(this.all_data); return; }
		this.show_loading(true);
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Queue Entry",
				filters: [
					["enqueued_at", ">=", from + " 00:00:00"],
					["enqueued_at", "<=", to   + " 23:59:59"],
				],
				fields: ["room", "enqueued_at"],
				limit: 5000,
			},
			callback: (r) => {
				this.show_loading(false);
				this.render_room_chart(r.message || []);
			},
			error: () => { this.show_loading(false); }
		});
	}

	// ── CHARTS ────────────────────────────────────────────────────────────────
	render_room_chart(data) {
		const by_room = {};
		data.forEach(d => { const r = d.room || "Unknown"; by_room[r] = (by_room[r] || 0) + 1; });
		const sorted = Object.entries(by_room).sort((a, b) => b[1] - a[1]);
		this.render_frappe_chart("hqs-room-chart", {
			type: "bar",
			data: { labels: sorted.map(s => s[0]), datasets: [{ name: "Visits", values: sorted.map(s => s[1]) }] },
			colors: ["#2490EF"], height: 240,
		});
	}

	render_time_chart(data) {
		const room_times = {};
		data.filter(d => d.enqueued_at && d.served_at).forEach(d => {
			const mins = (new Date(d.served_at) - new Date(d.enqueued_at)) / 60000;
			if (mins <= 0 || mins > 600) return;
			const r = d.room || "Unknown";
			if (!room_times[r]) room_times[r] = [];
			room_times[r].push(mins);
		});
		const sorted = Object.entries(room_times)
			.map(([r, t]) => [r, Math.round(t.reduce((a, b) => a + b, 0) / t.length)])
			.sort((a, b) => b[1] - a[1]);
		this.render_frappe_chart("hqs-time-chart", {
			type: "bar",
			data: { labels: sorted.map(s => s[0]), datasets: [{ name: "Avg min", values: sorted.map(s => s[1]) }] },
			colors: ["#6db8f7"], height: 240,
		});
	}

	render_daily_chart(data, from, to) {
		const by_date = {};
		data.forEach(d => {
			if (!d.enqueued_at) return;
			const date = d.enqueued_at.split(" ")[0];
			by_date[date] = (by_date[date] || 0) + 1;
		});
		const labels = [], values = [];
		let cur = new Date(from);
		const end = new Date(to);
		while (cur <= end) {
			const key = cur.toISOString().split("T")[0];
			labels.push(frappe.datetime.str_to_user(key));
			values.push(by_date[key] || 0);
			cur.setDate(cur.getDate() + 1);
		}
		this.render_frappe_chart("hqs-daily-chart", {
			type: "line",
			data: { labels, datasets: [{ name: "Arrivals", values }] },
			colors: ["#2490EF"], height: 220,
			lineOptions: { regionFill: 1 },
		});
	}

	// ── PEAK HOURS HEATMAP ──────────────────────────────────────────────────
	render_heatmap(data) {
		const el = document.getElementById("hqs-heatmap");
		if (!el) return;

		const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
		const hours = Array.from({length: 16}, (_, i) => i + 6); // 6am–9pm

		// Build count grid [day][hour]
		const grid = {};
		days.forEach(d => { grid[d] = {}; hours.forEach(h => { grid[d][h] = 0; }); });

		data.forEach(d => {
			if (!d.enqueued_at) return;
			const dt = new Date(d.enqueued_at);
			const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()];
			const hour = dt.getHours();
			if (grid[dow] && hour >= 6 && hour <= 21) grid[dow][hour]++;
		});

		const max = Math.max(1, ...days.flatMap(d => hours.map(h => grid[d][h])));

		const cell_w = 44, cell_h = 32;
		let html = `<div style="display:inline-block;min-width:100%">`;

		// Hour labels row
		html += `<div style="display:flex;margin-left:44px;margin-bottom:4px">`;
		hours.forEach(h => {
			const label = h < 12 ? h+"am" : h === 12 ? "12pm" : (h-12)+"pm";
			html += `<div style="width:${cell_w}px;text-align:center;font-size:10px;color:#6db8f7;font-weight:600">${label}</div>`;
		});
		html += `</div>`;

		// Rows
		days.forEach(day => {
			html += `<div style="display:flex;align-items:center;margin-bottom:3px">`;
			html += `<div style="width:40px;font-size:11px;font-weight:600;color:#1a5fa8;text-align:right;padding-right:6px;flex-shrink:0">${day}</div>`;
			hours.forEach(h => {
				const count = grid[day][h];
				const intensity = count / max;
				const bg = count === 0
					? "#f0f8ff"
					: `rgba(36,144,239,${(0.12 + intensity * 0.88).toFixed(2)})`;
				const color = intensity > 0.5 ? "#fff" : "#1a5fa8";
				const title = `${day} ${h<12?h+"am":h===12?"12pm":(h-12)+"pm"}: ${count} patient${count!==1?"s":""}`;
				html += `<div title="${title}" style="width:${cell_w}px;height:${cell_h}px;background:${bg};
					border-radius:4px;display:flex;align-items:center;justify-content:center;
					font-size:10px;font-weight:600;color:${color};margin:1px;cursor:default">
					${count > 0 ? count : ""}
				</div>`;
			});
			html += `</div>`;
		});

		// Legend
		html += `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;margin-left:44px">
			<span style="font-size:10px;color:#6db8f7">Low</span>`;
		[0.1, 0.3, 0.5, 0.7, 0.9].forEach(v => {
			html += `<div style="width:20px;height:14px;border-radius:3px;background:rgba(36,144,239,${(0.12+v*0.88).toFixed(2)})"></div>`;
		});
		html += `<span style="font-size:10px;color:#6db8f7">High</span></div>`;
		html += `</div>`;
		el.innerHTML = html;
	}

	// ── COUNTER PERFORMANCE ───────────────────────────────────────────────────
	render_counter_chart(data) {
		const counter_stats = {};

		data.forEach(d => {
			const c = d.counter || "Unassigned";
			if (!counter_stats[c]) counter_stats[c] = { visits: 0, times: [] };
			counter_stats[c].visits++;
			if (d.enqueued_at && d.served_at) {
				const mins = (new Date(d.served_at) - new Date(d.enqueued_at)) / 60000;
				if (mins > 0 && mins < 600) counter_stats[c].times.push(mins);
			}
		});

		const sorted = Object.entries(counter_stats)
			.map(([name, s]) => ({
				name,
				visits: s.visits,
				avg: s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length) : 0,
			}))
			.sort((a, b) => b.visits - a.visits);

		if (!sorted.length) {
			const el = document.getElementById("hqs-counter-chart");
			if (el) el.innerHTML = `<p class="text-muted" style="padding:20px;text-align:center;">No counter data available</p>`;
			return;
		}

		// Two datasets: visits count + avg turnaround
		this.render_frappe_chart("hqs-counter-chart", {
			type: "bar",
			data: {
				labels: sorted.map(s => s.name),
				datasets: [
					{ name: "Visits",         values: sorted.map(s => s.visits), chartType: "bar" },
					{ name: "Avg Time (min)", values: sorted.map(s => s.avg),    chartType: "line" },
				],
			},
			colors: ["#2490EF", "#6db8f7"],
			height: 240,
			axisOptions: { xAxisMode: "tick" },
		});
	}

	render_frappe_chart(el_id, config) {
		const el = document.getElementById(el_id);
		if (!el) return;
		try { new frappe.Chart(el, config); }
		catch (e) { el.innerHTML = `<p class="text-muted" style="padding:20px;text-align:center;">No data</p>`; }
	}

	// ── TABLE ─────────────────────────────────────────────────────────────────
	render_table(data) {
		$("#hqs-record-count").text(`${data.length.toLocaleString()} records`);
		const columns = [
			{ name: "Token",      id: "token_number",  width: 90  },
			{ name: "Patient",    id: "patient",       width: 150 },
			{ name: "From Room",  id: "previous_room", width: 130 },
			{ name: "To Room",    id: "room",          width: 130 },
			{ name: "Priority",   id: "priority",      width: 90  },
			{ name: "Status",     id: "status",        width: 90  },
			{ name: "Arrived",    id: "enqueued_at",   width: 130 },
			{ name: "Called",     id: "called_at",     width: 130 },
			{ name: "Served",     id: "served_at",     width: 130 },
			{ name: "Turnaround", id: "turnaround",    width: 100 },
		];
		const rows = data.map(d => {
			let turnaround = "–";
			if (d.enqueued_at && d.served_at) {
				const mins = Math.round((new Date(d.served_at) - new Date(d.enqueued_at)) / 60000);
				if (mins >= 0 && mins < 600) turnaround = mins + " min";
			}
			return {
				token_number:  d.token_number || d.name,
				patient:       d.patient || "–",
				previous_room: d.previous_room || "–",
				room:          d.room || "–",
				priority:      this.priority_badge(d.priority),
				status:        this.status_badge(d.status),
				enqueued_at:   d.enqueued_at ? d.enqueued_at.slice(0, 16) : "–",
				called_at:     d.called_at   ? d.called_at.slice(0, 16)   : "–",
				served_at:     d.served_at   ? d.served_at.slice(0, 16)   : "–",
				turnaround,
			};
		});
		const wrap = document.getElementById("hqs-datatable");
		wrap.innerHTML = "";
		if (!rows.length) {
			wrap.innerHTML = `<p class="text-muted" style="padding:24px;text-align:center;">No records found for the selected filters.</p>`;
			return;
		}
		try {
			this.datatable = new DataTable(wrap, { columns, data: rows, layout: "fluid", serialNoColumn: true });
		} catch (e) {
			wrap.innerHTML = this.build_html_table(columns, rows);
		}
	}

	build_html_table(columns, rows) {
		const h = columns.map(c => `<th>${c.name}</th>`).join("");
		const b = rows.map((r, i) =>
			`<tr><td>${i+1}</td>${columns.map(c => `<td>${r[c.id]}</td>`).join("")}</tr>`
		).join("");
		return `<div style="overflow-x:auto;"><table class="hqs-table">
			<thead><tr><th>#</th>${h}</tr></thead><tbody>${b}</tbody></table></div>`;
	}

	status_badge(s) {
		const c = { Done:"#2490EF", Serving:"#6db8f7", Called:"#a8d8f8", Waiting:"#b8dcfb", "No Show":"#94a3b8" };
		const col = c[s] || "#94a3b8";
		return `<span style="background:${col}22;color:${col};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${s||"–"}</span>`;
	}

	priority_badge(p) {
		const c = { Normal:"#2490EF", Urgent:"#1a6fbe", Emergency:"#0a4a8a" };
		const col = c[p] || "#2490EF";
		return `<span style="background:${col}22;color:${col};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${p||"–"}</span>`;
	}

	// ── EXPORT ────────────────────────────────────────────────────────────────
	export_csv() {
		if (!this.table_data?.length) { frappe.msgprint("No data to export."); return; }
		const fields = ["token_number","patient","previous_room","room","priority","status","enqueued_at","called_at","served_at"];
		const header = [...fields, "turnaround_min"].join(",");
		const rows = this.table_data.map(d => {
			let mins = "";
			if (d.enqueued_at && d.served_at) {
				const t = Math.round((new Date(d.served_at) - new Date(d.enqueued_at)) / 60000);
				if (t >= 0 && t < 600) mins = t;
			}
			return [...fields.map(f => `"${(d[f]||"").toString().replace(/"/g,'""')}"`), `"${mins}"`].join(",");
		}).join("\n");
		const blob = new Blob([header+"\n"+rows], { type:"text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `hqs_journey_${new Date().toISOString().slice(0,10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	show_loading(show) { $("#hqs-loading").toggle(show); }

	// ── STYLES ────────────────────────────────────────────────────────────────
	inject_styles() {
		if (document.getElementById("hqs-reports-style")) return;
		const s = document.createElement("style");
		s.id = "hqs-reports-style";
		s.textContent = `
		.hqs-reports-page{padding:16px;position:relative;font-family:var(--font-stack)}

		/* KPI CARDS */
		.hqs-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:18px}
		.hqs-kpi-card{border-radius:10px;padding:16px 18px;display:flex;align-items:center;gap:14px;
			background:#fff;border:1.5px solid #b8dcfb;transition:transform .15s,box-shadow .15s}
		.hqs-kpi-card:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(36,144,239,.15)}
		.hqs-kpi-icon{width:40px;height:40px;border-radius:10px;background:#e8f4fd;color:#2490EF;
			font-size:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
		.hqs-kpi-value{font-size:26px;font-weight:700;color:#1a5fa8;line-height:1.1}
		.hqs-kpi-label{font-size:11.5px;color:#6db8f7;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}

		/* CARDS */
		.hqs-card{background:#fff;border-radius:10px;border:1px solid #daeeff;overflow:hidden;margin-bottom:16px}
		.hqs-card-header{display:flex;align-items:center;justify-content:space-between;padding:13px 18px 8px;
			font-weight:600;font-size:13px;color:#1a5fa8;border-bottom:1px solid #e8f4fd;background:#f5fbff}
		.hqs-badge{background:#2490EF;color:#fff;font-size:11px;font-weight:600;padding:2px 9px;border-radius:10px}
		.hqs-record-count{font-size:12px;font-weight:500;color:#6db8f7}
		.hqs-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
		.hqs-charts-row .hqs-card{margin-bottom:0}
		@media(max-width:768px){.hqs-charts-row{grid-template-columns:1fr}}

		/* INLINE CARD FILTERS (room chart) */
		.hqs-inline-filters{display:flex;align-items:center;gap:8px}
		.hqs-inline-group{display:flex;align-items:center;gap:4px}
		.hqs-inline-group label{font-size:10px;font-weight:700;color:#6db8f7;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
		.hqs-inline-group input{height:24px;padding:0 6px;border:1px solid #b8dcfb;border-radius:5px;
			font-size:11px;color:#1a5fa8;background:#fff;outline:none;width:110px}
		.hqs-inline-group input:focus{border-color:#2490EF}
		.hqs-inline-btn{height:24px;padding:0 10px;background:#2490EF;color:#fff;border:none;
			border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap}
		.hqs-inline-btn:hover{background:#1a7fd4}

		/* TABLE FILTER BAR (inside card) */
		.hqs-table-filters{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;
			padding:12px 16px;background:#f5fbff;border-bottom:1px solid #daeeff}
		.hqs-fg{display:flex;flex-direction:column;gap:3px;min-width:100px}
		.hqs-fg label{font-size:10px;font-weight:700;color:#2490EF;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
		.hqs-fg input,.hqs-fg select{height:28px;padding:0 7px;border:1px solid #b8dcfb;
			border-radius:5px;font-size:12px;color:#1a5fa8;background:#fff;outline:none;width:100%}
		.hqs-fg input:focus,.hqs-fg select:focus{border-color:#2490EF;box-shadow:0 0 0 2px #2490ef22}
		.hqs-journey-wrap{display:flex;align-items:flex-end;gap:6px}
		.hqs-arrow{font-size:18px;color:#2490EF;font-weight:700;padding-bottom:4px;flex-shrink:0}
		.hqs-filter-btns label{color:transparent!important}
		.hqs-btn-apply{height:28px;padding:0 12px;background:#2490EF;color:#fff;border:none;
			border-radius:5px;font-size:12px;font-weight:600;cursor:pointer}
		.hqs-btn-apply:hover{background:#1a7fd4}
		.hqs-btn-clear{height:28px;padding:0 10px;background:#fff;color:#2490EF;
			border:1px solid #b8dcfb;border-radius:5px;font-size:12px;cursor:pointer}
		.hqs-btn-clear:hover{background:#f0f8ff}

		/* CHIPS */
		.hqs-chip{background:#2490EF;color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}

		/* TABLE */
		.hqs-datatable-wrap{overflow-x:auto}
		.hqs-table{width:100%;border-collapse:collapse;font-size:12.5px}
		.hqs-table th{background:#f0f8ff;padding:9px 12px;text-align:left;font-weight:600;
			color:#2490EF;font-size:11px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;border-bottom:2px solid #b8dcfb}
		.hqs-table td{padding:8px 12px;border-bottom:1px solid #e8f4fd;color:#334155;vertical-align:middle}
		.hqs-table tr:hover td{background:#f5fbff}

		/* LOADING */
		.hqs-loading-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,.8);
			display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:100;font-size:14px;color:#6db8f7}
		.hqs-spinner{width:36px;height:36px;border:3px solid #b8dcfb;border-top-color:#2490EF;
			border-radius:50%;animation:hqs-spin .7s linear infinite}
		@keyframes hqs-spin{to{transform:rotate(360deg)}}`;
		document.head.appendChild(s);
	}
}