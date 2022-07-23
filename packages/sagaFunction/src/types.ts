export type BookingEntry = {
  pk: string;
  sk: string;
  id: string;
  trip_id: string;
  transaction_status: 'pending' | 'confirmed';
} & (
  | {
    type: 'Hotel';
    hotel: string;
    check_in: string;
    check_out: string;
  }
  | {
    type: 'Flight';
    depart: string;
    depart_at: string;
    arrive: string;
    arrive_at: string;
  }
  | {
    type: 'Payment';
    amount: string;
    currency: string;
  }
);

export interface Reservation {
  trip_id: string;
  depart: string;
  depart_at: string;
  arrive: string;
  arrive_at: string;
  hotel: string;
  check_in: string;
  check_out: string;
  rental: string;
  rental_from: string;
  rental_to: string;
  /**
   * Special flag to test failures in the machine.
   */
  run_type?:
  | 'failPayment'
  | 'failFlightsReservation'
  | 'failHotelReservation'
  | 'failFlightsConfirmation'
  | 'failHotelConfirmation';
}
