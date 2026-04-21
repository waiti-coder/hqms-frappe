// Copyright (c) 2026, ed/mwihaki and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Doctor Room Assignment", {
// 	refresh(frm) {

// 	},
// });
// Copyright (c) 2026, ed/mwihaki and contributors
// For license information, please see license.txt

frappe.ui.form.on("Doctor Room Assignment", {
    refresh: function(frm) {
        frm.clear_custom_buttons();

        // Only the assigned doctor or System Manager can update status
        const current_user = frappe.session.user;
        const is_system_manager = frappe.user.has_role('System Manager');

        // Check if current user is the assigned doctor
        frappe.db.get_value('Healthcare Practitioner',
            { user: current_user }, 'name'
        ).then(r => {
            const practitioner = r.message?.name;
            const is_own_record = practitioner && practitioner === frm.doc.doctor;

            if (!is_own_record && !is_system_manager) {
                // Receptionist/Nurse — read only, no buttons
                frm.set_read_only();
                return;
            }

            // Quick status buttons for the doctor
            if (frm.doc.status !== 'Active') {
                frm.add_custom_button(__('✅ Set Active'), function() {
                    update_status(frm, 'Active');
                }).addClass('btn-success');
            }

            if (frm.doc.status !== 'On Break') {
                frm.add_custom_button(__('☕ On Break'), function() {
                    update_status(frm, 'On Break');
                }).addClass('btn-warning');
            }

            if (frm.doc.status !== 'Done') {
                frm.add_custom_button(__('✔ Done for Today'), function() {
                    frappe.confirm(
                        __('Mark yourself as Done for today? This will remove you from the active doctors list.'),
                        () => update_status(frm, 'Done')
                    );
                }).addClass('btn-danger');
            }
        });
    }
});

function update_status(frm, new_status) {
    frappe.call({
        method: 'hqs.hqs.api.update_doctor_status',
        args: {
            assignment: frm.doc.name,
            status: new_status
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert({
                    message: `Status updated to ${new_status}`,
                    indicator: new_status === 'Active' ? 'green'
                              : new_status === 'On Break' ? 'orange'
                              : 'grey'
                }, 4);
                frm.reload_doc();
            } else {
                frappe.show_alert({
                    message: r.message?.message || __('Could not update status'),
                    indicator: 'red'
                }, 4);
            }
        }
    });
}