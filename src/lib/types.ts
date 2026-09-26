// Field names here are exact matches to Logistics-backend's Orgin.java (Jackson deserializes
// createOrgin's JSON payload by exact property name, case-sensitive, no naming-strategy
// override configured) — do not rename these to "nicer" camelCase without checking that class
// first; a mismatch here silently drops the field server-side (e.g. sending "customer" instead
// of "customer_id" leaves cust_id NULL and the insert fails the NOT NULL constraint).
//
// Several fields double-duty by request direction: on read (GET /getOrgin, /getDestination/{id})
// SELECT_ORGIN aliases customer/vehicle_type/shipment_route_from/shipment_route_to to the
// human-readable *name* (joined from generic_data/location), with the numeric id available
// separately as customer_id/vehicle_id/shipment_route_from_id/shipment_route_to_id. On write
// (POST /createOrgin), customer_id/shipment_route_from_id/shipment_route_to_id/vehicle_type are
// the ones actually read by the backend's INSERT — vehicle_type specifically holds the numeric
// id (as a string) on write, not a name, unlike its read-side meaning.
export interface Orgin {
  id?: number;
  customer?: string;        // read-only: customer display name
  customer_id?: string;     // write: customer's generic_data id (category='ORGIN')
  shipment_no?: string;
  shipment_route_from?: string;    // read-only: location display name
  shipment_route_from_id?: string; // write: location id
  shipment_route_to?: string;      // read-only: location display name
  shipment_route_to_id?: string;   // write: location id
  vehicle_type?: string;    // read: display name; write: generic_data id (category='VEHICLE_TYPE') as a string
  vehicle_id?: string;      // read-only: vehicle type's numeric id
  vehicle_no?: string;
  lr_no?: string;
  lr_date?: string;
  transporter_name?: string;        // denormalized snapshot; prefer transporter_master_name for display
  transporter_master_id?: number;   // write: the transporter's id in Transporter Master
  transporter_master_name?: string; // read-only: live name, joined from Transporter Master by id
  transit_days?: string;
  fast_mode?: 'Y' | 'N';
  isfastflag?: boolean;
  odc?: 'Y' | 'N';
  fast_mode_applicable_or_not?: 'Y' | 'N';
  delay_applicable_or_not?: 'Y' | 'N';
  vehicle_reported_on?: string;
  flag?: 'O' | 'D';         // 'O' = Origin (outbound from this location), 'D' = Destination (inbound)
  org_status?: 'O' | 'C' | 'S'; // Open -> Work-in-progress (Save) -> Submitted (locked)
  curr_status?: string;     // computed display status: NEW/TRANSIT/RECEIVED/WORK IN-PROGRESS/OVER DUE
  // Capital "By" is not a typo — Jackson derives the JSON key from the Java getter
  // (getCreated_By/getUpdated_By) by stripping "get" and lowercasing only the first
  // character, so the wire property really is "created_By"/"updated_By".
  created_By?: string;
  updated_By?: string;
  createdDate?: string;
  deleteFlag?: boolean;
}

export interface GenericData {
  id?: number;
  data?: string;
  category?: string;
}

export interface Location {
  id?: number;
  name?: string;
}

export interface OrginImage {
  id?: number;
  name?: string;
  type?: string;
  category?: string;
  file_name?: string;
  s3_url?: string; // pre-signed by the backend before it reaches the client
}

// Matches Logistics-backend's FilterData.java exactly (same case-sensitive-JSON caveat as
// Orgin above). loc_id is a string (parsed server-side with Integer.parseInt) — pass '' for "no
// fixed location" on the plain list endpoint (falls back to no location filter), but note
// /shipmentGraphInfo and /dashorgininfo need the literal string '-1' instead — see the comment
// in dashboard/page.tsx.
// Matches Logistics-backend's TransporterMaster.java exactly (BeanPropertyRowMapper maps
// snake_case DB/query columns to these camelCase getters automatically; Jackson serializes
// by getter name as-is, so the wire shape is already camelCase — no case-sensitivity gotcha
// here like Orgin above).
export interface Transporter {
  id?: number;
  name?: string;
  email?: string;
  mobile?: string;
  contactPerson?: string;
  createdBy?: number;
  createdDate?: string;
  modifiedBy?: number;
  modifiedDate?: string;
  status?: number;
  /** List/read only — count of active shipments whose transporter_name matches this row's
   *  name (case-insensitively). Never sent on create/update. */
  shipmentCount?: number;
  /** Write-only — set once the "this will rename N shipments" warning has already been shown
   *  and confirmed. See TransporterMasterServiceImpl.update() on the backend. */
  confirmed?: boolean;
}

// Matches Logistics-backend's BillingDetails.java exactly (camelCase both ways, same as
// Transporter above — no case-sensitivity gotcha here, unlike Orgin). One row per shipment;
// totalBillingAmount/customerTotalAmount/shipmentNo are read-only, computed/joined server-side.
export interface BillingDetails {
  id?: number;
  orginId?: number;
  shipmentNo?: string;
  grnNumber?: string;
  podStatus?: 'Y' | 'N' | '';
  invoiceNumber?: string;
  invoiceDate?: string;
  baseFare?: number | string;
  haltingCharges?: number | string;
  totalBillingAmount?: number;
  customerInvoiceNo?: string;
  customerInvoiceDate?: string;
  customerBaseFare?: number | string;
  customerHaltingCharges?: number | string;
  customerTotalAmount?: number;
  status?: 'DRAFT' | 'FINAL';
  createdBy?: number;
  createdDate?: string;
  modifiedBy?: number;
  modifiedDate?: string;
}

// A row from /billingDetails/eligibleShipments — same shape as the fields SELECT_ORGIN
// happens to alias the same way (customer/vehicle_no/transporter_name/lr_date), reusing Orgin's
// field names rather than inventing a parallel set.
export interface EligibleShipment {
  id?: number;
  shipment_no?: string;
  customer?: string;
  vehicle_no?: string;
  transporter_name?: string;
  lr_date?: string;
}

export interface OrginFilter {
  fromDate?: string;
  toDate?: string;
  loc_id?: string;
  flag?: 'O' | 'D';
  status?: string[];
  received_fromDate?: string;
  received_toDate?: string;
  transName?: string[];
}
