/* How long free text may be. Ledger's database refuses anything longer
   (migration 0037); the forms cap at the same length, or shorter, so a
   person never meets the database's refusal by typing. */
export const TEXT_MAX = 200
export const NOTE_FORM_MAX = 500
