/**
 * The id of the Person type (ADR 0113), which the Contacts App owns. Core
 * names it so that other Apps' People fields (an Event's With…) can restrict
 * themselves to it without importing Contacts.
 */
export const PERSON_TYPE = "contacts_person";
