// Copyright (c) 2026, ed/mwihaki and contributors
// For license information, please see license.txt

frappe.ui.form.on("Queue Entry", {
    refresh: function(frm) {
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

                if (!frm.doc.care_pathway) {
                    frappe.msgprint({
                        title: __('Care Pathway Required'),
                        message: __('Please select a Care Pathway before marking this patient as done.'),
                        indicator: 'orange'
                    });
                    frm.scroll_to_field('care_pathway');
                    return;
                }

                frappe.confirm(
                    __('Mark <b>') + frm.doc.token_number + __('</b> as Done and send to <b>') + frm.doc.care_pathway + __('</b>?'),
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

                                    frappe.call({
                                        method: 'hqs.hqs.api.call_next_patient',
                                        args: {
                                            department: frm.doc.department,
                                            counter: frm.doc.counter || 'Counter 1'
                                        },
                                        callback: function(r2) {
                                            if (r2.message && r2.message.success) {
                                                frappe.show_alert({
                                                    message: __('Now calling Token ') + r2.message.token,
                                                    indicator: 'blue'
                                                }, 4);
                                                frappe.set_route('Form', 'Queue Entry', r2.message.queue_entry);
                                            } else {
                                                frappe.show_alert({
                                                    message: __('No more patients waiting'),
                                                    indicator: 'orange'
                                                }, 4);
                                                frappe.set_route('List', 'Queue Entry');
                                            }
                                        }
                                    });

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


frappe.listview_settings['Queue Entry'] = {
    // Use refresh instead of onload — more reliable across Frappe versions
    refresh: function(listview) {
        // Avoid adding the button multiple times on repeated refreshes
        if (listview.call_next_added) return;
        listview.call_next_added = true;

        // Add as a secondary button next to the primary "Add" button
        listview.page.add_inner_button(__('Call Next'), function() {

            frappe.call({
                method: 'hqs.hqs.api.peek_next_patient',
                args: { department: 'Reception' },
                callback: function(r) {
                    if (!r.message || !r.message.success) {
                        frappe.msgprint({
                            title: __('Queue Empty'),
                            message: __('There are no patients currently waiting in Reception.'),
                            indicator: 'blue'
                        });
                        return;
                    }

                    const next = r.message;
                    const priority_color = {
                        'Emergency': '<span style="color:red;font-weight:700;">🚨 Emergency</span>',
                        'Urgent':    '<span style="color:orange;font-weight:700;">⚠️ Urgent</span>',
                        'Normal':    '<span style="color:green;font-weight:700;">✔ Normal</span>',
                    }[next.priority] || next.priority;

                    const dialog = new frappe.ui.Dialog({
                        title: __('Call Next Patient'),
                        fields: [
                            {
                                fieldtype: 'HTML',
                                options: `
                                    <div style="background:#f0f4ff;border-radius:10px;padding:16px 20px;margin-bottom:16px;border-left:4px solid #2B5BA8;">
                                        <div style="font-size:0.75rem;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Next in Queue</div>
                                        <div style="font-size:2.2rem;font-weight:900;color:#2B5BA8;line-height:1;">${next.token_number}</div>
                                        <div style="margin-top:8px;font-size:0.95rem;color:#555;line-height:1.8;">
                                            Patient: <b>${next.patient || '—'}</b><br>
                                            Priority: ${priority_color}<br>
                                            Waiting: <b>${next.waiting_since}</b>
                                        </div>
                                    </div>
                                    <p style="color:#888;font-size:0.85rem;">Select a counter to call this patient.</p>
                                `
                            },
                            {
                                label: __('Counter'),
                                fieldname: 'counter',
                                fieldtype: 'Link',
                                options: 'Queue Counter',
                                reqd: 1,
                                get_query: () => ({ filters: { is_active: 1 } })
                            }
                        ],
                        primary_action_label: __('Call Patient'),
                        primary_action: function(values) {
                            dialog.hide();

                            frappe.call({
                                method: 'hqs.hqs.api.call_next_patient',
                                args: {
                                    department: 'Reception',
                                    counter: values.counter
                                },
                                callback: function(r2) {
                                    if (r2.message && r2.message.success) {
                                        frappe.show_alert({
                                            message: __('Calling Token ') + r2.message.token,
                                            indicator: 'green'
                                        }, 4);
                                        frappe.set_route('Form', 'Queue Entry', r2.message.queue_entry);
                                    } else {
                                        frappe.show_alert({
                                            message: r2.message?.message || __('No patients waiting'),
                                            indicator: 'red'
                                        }, 4);
                                    }
                                }
                            });
                        }
                    });

                    dialog.show();
                }
            });
        });
    },

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