// Copyright (c) 2026, ed/mwihaki and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Queue Entry", {
// 	refresh(frm) {

// 	},
// });
frappe.listview_settings['Queue Entry'] = {
    get_indicator: function(doc) {
        if (doc.status === 'Waiting') return [__('Waiting'), 'orange', 'status,=,Waiting'];
        if (doc.status === 'Called') return [__('Called'), 'blue', 'status,=,Called'];
        if (doc.status === 'Serving') return [__('Serving'), 'green', 'status,=,Serving'];
        if (doc.status === 'Done') return [__('Done'), 'grey', 'status,=,Done'];
        if (doc.status === 'No Show') return [__('No Show'), 'red', 'status,=,No Show'];
    },

    button: {
        show: function(doc) {
            return doc.status === 'Waiting';
        },
        get_label: function() {
            return 'Call Patient';
        },
        get_description: function(doc) {
            return 'Call ' + doc.token_number;
        },
        action: function(doc) {
            frappe.prompt([
                {
                    label: 'Counter',
                    fieldname: 'counter',
                    fieldtype: 'Link',
                    options: 'Queue Counter',
                    reqd: 1
                }
            ],
            function(values) {
                frappe.call({
                    method: 'hqs.hqs.api.call_next_patient',
                    args: {
                        department: doc.department,
                        counter: values.counter
                    },
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: 'Called ' + r.message.token,
                                indicator: 'green'
                            });
                            cur_list.refresh();
                        } else {
                            frappe.show_alert({
                                message: r.message.message || 'Error calling patient',
                                indicator: 'red'
                            });
                        }
                    }
                });
            },
            'Select Counter',
            'Call Patient'
            );
        }
    }
};