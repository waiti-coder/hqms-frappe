app_name = "hqs"
app_title = "hqs"
app_publisher = "ed/mwihaki"
app_description = "hqs"
app_email = "edwinwaititu@gmail.com"
app_license = "mit"

# Automatically update python controller files with type annotations for this app.
export_python_type_annotations = True

# Require all whitelisted methods to have type annotations
require_type_annotated_api_methods = True

# Fixtures — data to sync on migrate
fixtures = [
    {
        "doctype": "Queue Counter",
        "filters": [["is_active", "=", 1]]
    }
]

# Permission query conditions — controls what each user sees
permission_query_conditions = {
    "Queue Entry": "hqs.hqs.doctype.queue_entry.queue_entry.get_permission_query_conditions"
}
doc_events = {
    "User": {
        "after_insert": "hqs.hqs.utils.fix_user_default_app",
        "on_update": "hqs.hqs.utils.fix_user_default_app"
    }
}

fixtures = [
    {
        "doctype": "QMS Room",
        "filters": [["active", "=", 1]]
    },
    {
        "doctype": "Queue Counter",
        "filters": [["is_active", "=", 1]]
    },
    {
        "doctype": "QMS Room Routing"
    }
]
# hooks.py
on_session_creation = "hqs.hqs.api.set_default_route"
default_homepage = "reception-desks"
