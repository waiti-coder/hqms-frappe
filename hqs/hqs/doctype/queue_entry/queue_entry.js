// Copyright (c) 2026, ed/mwihaki and contributors
// For license information, please see license.txt

frappe.ui.form.on("Queue Entry", {
    refresh: function(frm) {
        // Remove all custom buttons first
        frm.clear_custom_buttons();

        // CALL PATIENT button — show when Waiting
        if (frm.doc.status === 'Waiting') {
            frm.add_custom_button(__('Call Patient'), function() {
                frappe.prompt(
                    [{
                        label: __('Counter'),
                        fieldname: 'counter',
                        fieldtype: 'Link',
                        options: 'Queue Counter',
                        reqd: 1,
                        get_query: () => ({
                            filters: { department: frm.doc.department, is_active: 1 }
                        })
                    }],
                    function(values) {
                        frappe.call({
                            method: 'hqs.hqs.api.call_next_patient',
                            args: {
                                department: frm.doc.department,
                                counter: values.counter,
                                queue_entry: frm.doc.name
                            },
                            callback: function(r) {
                                if (r.message && r.message.success) {
                                    frappe.show_alert({
                                        message: __('Called ') + r.message.token,
                                        indicator: 'green'
                                    });
                                    frm.reload_doc();
                                } else {
                                    frappe.show_alert({
                                        message: r.message.message || __('Error'),
                                        indicator: 'red'
                                    });
                                }
                            }
                        });
                    },
                    __('Select Counter'),
                    __('Call Patient')
                );
            }).addClass('btn-primary');
        }

        // DONE & NEXT button — show when Called or Serving
        if (frm.doc.status === 'Called' || frm.doc.status === 'Serving') {
            frm.add_custom_button(__('Done & Next Department'), function() {
                frappe.confirm(
                    __('Mark ') + frm.doc.token_number + __(' as Done and move to next department?'),
                    function() {
                        frappe.call({
                            method: 'hqs.hqs.api.mark_done_and_next',
                            args: { queue_entry: frm.doc.name },
                            callback: function(r) {
                                if (r.message && r.message.success) {
                                    frappe.show_alert({
                                        message: r.message.message,
                                        indicator: 'green'
                                    });
                                    frm.reload_doc();
                                } else {
                                    frappe.show_alert({
                                        message: r.message.message || __('Error'),
                                        indicator: 'red'
                                    });
                                }
                            }
                        });
                    }
                );
            }).addClass('btn-success');
        }

        // NO SHOW button — show when Called
        if (frm.doc.status === 'Called') {
            frm.add_custom_button(__('No Show'), function() {
                frappe.confirm(
                    __('Mark ') + frm.doc.token_number + __(' as No Show?'),
                    function() {
                        frappe.db.set_value('Queue Entry', frm.doc.name, 'status', 'No Show')
                            .then(() => {
                                frappe.show_alert({ message: __('Marked as No Show'), indicator: 'orange' });
                                frm.reload_doc();
                            });
                    }
                );
            }).addClass('btn-danger');
        }
    }
});

// Keep list view indicators
frappe.listview_settings['Queue Entry'] = {
    get_indicator: function(doc) {
        const indicators = {
            'Waiting': [__('Waiting'), 'orange', 'status,=,Waiting'],
            'Called':  [__('Called'),  'blue',   'status,=,Called'],
            'Serving': [__('Serving'), 'green',  'status,=,Serving'],
            'Done':    [__('Done'),    'grey',   'status,=,Done'],
            'No Show': [__('No Show'), 'red',    'status,=,No Show'],
        };
        return indicators[doc.status];
    }
};