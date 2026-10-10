# Odiscom Supply SharePoint Permission Matrix

This matrix applies only to the Odiscom Supply internal SharePoint environment.

| Surface | Platform Admins | Operations | Sales | Procurement | Fulfillment | Finance | ReadOnly | External Customers | External Suppliers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Operations Documents | Edit | Edit | Read | Read | Read | Read | Read | No | No |
| Customer Records | Full | Edit | Edit | Read | Read | Read | Read | No direct site access | No |
| Supplier Records | Full | Edit | Read | Edit | Read | Read | Read | No | No direct site access |
| Procurement Evidence | Full | Edit | Read | Edit | Read | Read | Read | No | No direct site access |
| Sales Orders and Fulfillment | Full | Edit | Edit | Read | Edit | Read | Read | No direct site access | No |
| Review Queue | Full | Edit | Edit | Edit | Edit | Read | Read | No | No |
| Exception Queue | Full | Edit | Edit | Edit | Edit | Read | Read | No | No |
| Process Checklists | Full | Edit | Edit | Edit | Edit | Edit | Read | No | No |

## Rules

- External customers and suppliers do not receive default membership in the internal SharePoint site.
- Customer/supplier files are delivered through the application/API layer unless a specific SharePoint sharing workflow is separately approved.
- Group membership is explicit; email-domain membership alone is not authorization.
- Odiscom LLC customer users are external customers from the Odiscom Supply perspective.
- An Odiscom LLC employee who also works for Odiscom Supply receives internal rights only through an explicitly approved Odiscom Supply workforce/guest assignment.
- App-only Graph access should use `Sites.Selected` and be limited to the Odiscom Supply site(s).
- No Odiscom Supply group is granted access to Odiscom LLC SharePoint merely because both companies are related.
