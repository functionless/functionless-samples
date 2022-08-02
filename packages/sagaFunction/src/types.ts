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

/*
{
    "trip_id": tripID, //taken from queryParams
    "depart": "London",
    "depart_at": "2021-07-10T06:00:00.000Z",
    "arrive": "Dublin",
    "arrive_at": "2021-07-12T08:00:00.000Z",
    "hotel": "holiday inn",
    "check_in": "2021-07-10T12:00:00.000Z",
    "check_out": "2021-07-12T14:00:00.000Z",
    "rental": "Volvo",
    "rental_from": "2021-07-10T00:00:00.000Z",
    "rental_to": "2021-07-12T00:00:00.000Z",
    "run_type": runType //taken from queryParams
};
 */

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
}

export interface ReservationRequest {
  reservation: Reservation;
  run_type: RunType;
}

/**
 * Special flag to test failures in the machine.
 */
export type RunType =
  | 'failPayment'
  | 'failFlightsReservation'
  | 'failHotelReservation'
  | 'failFlightsConfirmation'
  | 'failHotelConfirmation';
