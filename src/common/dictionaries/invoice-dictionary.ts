export const invoiceToDbDictionary : Record<string, string> = {
    hs_object_id: 'hubspot_id',
    hs_invoice_status: 'invoice_status',
    hs_payment_status: 'payment_status',
    hs_amount_billed: 'invoice_amount',
    hs_currency: 'currency',
    hs_pdf_download_link: 'hubspot_pdf_link',
    //paid_at: 'paid_at',
}

export const dbToInvoiceDictionary : Record<string, string> = Object.fromEntries(
    Object.entries(invoiceToDbDictionary).map(([key, value]) => [value, key]));