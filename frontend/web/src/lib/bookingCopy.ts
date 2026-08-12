/** Booking engine copy by UI language (en / fr / pt / ar / es). */
export type BookingCopy = {
  changeCity: string;
  headline: string;
  subhead: string;
  pickupNow: string;
  share: string;
  pickupPlaceholder: string;
  dropoffPlaceholder: string;
  seePrices: string;
  gettingPrices: string;
  loginRecent: string;
  openDashboard: string;
  chooseRide: string;
  nearby: string;
  bestValue: string;
  confirming: string;
  loginToBook: string;
  request: string;
  sideTitle: string;
  sideBody: string;
  sideCta: string;
  needDropoff: string;
  noVehicles: string;
  quoteFailed: string;
  pickVehicle: string;
  booked: string;
  shareJoined: string;
  shareWaiting: string;
  mapsHint: string;
  detecting: string;
  chargedIn: string;
};

const EN: BookingCopy = {
  changeCity: 'Change city',
  headline: 'Go anywhere with Movr',
  subhead: 'Cars, okada, and shared rides — priced in your local currency.',
  pickupNow: 'Pickup now',
  share: 'Share · lower fare',
  pickupPlaceholder: 'Pickup location',
  dropoffPlaceholder: 'Dropoff location',
  seePrices: 'See prices',
  gettingPrices: 'Getting prices…',
  loginRecent: 'Log in to see your recent activity',
  openDashboard: 'Open ride dashboard',
  chooseRide: 'Choose a ride',
  nearby: 'Nearby',
  bestValue: 'Best value',
  confirming: 'Confirming…',
  loginToBook: 'Log in to book',
  request: 'Request',
  sideTitle: 'Ready to travel?',
  sideBody: 'Same booking rails as the Movr app — quote, share pools, and live driver matching.',
  sideCta: 'Create account',
  needDropoff: 'Enter a dropoff location',
  noVehicles: 'No vehicles available for this route',
  quoteFailed: 'Could not get prices',
  pickVehicle: 'Pick a vehicle',
  booked: 'Ride requested — finding a driver',
  shareJoined: 'Shared vehicle matching',
  shareWaiting: 'Joined share pool — waiting for riders',
  mapsHint: 'Add Google Maps in Admin → Integrations to enable address search.',
  detecting: 'Detecting your city…',
  chargedIn: 'Prices in',
};

const FR: BookingCopy = {
  ...EN,
  changeCity: 'Changer de ville',
  headline: 'Allez partout avec Movr',
  subhead: 'Voitures, okada et trajets partagés — en devise locale.',
  pickupNow: 'Départ maintenant',
  share: 'Partage · tarif réduit',
  pickupPlaceholder: 'Lieu de prise en charge',
  dropoffPlaceholder: 'Destination',
  seePrices: 'Voir les prix',
  gettingPrices: 'Calcul des prix…',
  loginRecent: 'Connectez-vous pour voir votre activité',
  openDashboard: 'Ouvrir le tableau de bord',
  chooseRide: 'Choisir une course',
  nearby: 'À proximité',
  bestValue: 'Meilleur rapport',
  confirming: 'Confirmation…',
  loginToBook: 'Connectez-vous pour réserver',
  request: 'Demander',
  sideTitle: 'Prêt à voyager ?',
  sideBody: 'Les mêmes parcours que l’app Movr — devis, covoiturage et matching conducteur.',
  sideCta: 'Créer un compte',
  needDropoff: 'Indiquez une destination',
  noVehicles: 'Aucun véhicule sur cet itinéraire',
  quoteFailed: 'Impossible d’obtenir les prix',
  pickVehicle: 'Choisissez un véhicule',
  booked: 'Course demandée — recherche d’un chauffeur',
  shareJoined: 'Véhicule partagé en matching',
  shareWaiting: 'Pool rejoint — en attente de passagers',
  mapsHint: 'Ajoutez Google Maps dans Intégrations pour la recherche d’adresses.',
  detecting: 'Détection de votre ville…',
  chargedIn: 'Tarifs en',
};

const PT: BookingCopy = {
  ...EN,
  changeCity: 'Mudar cidade',
  headline: 'Vá a qualquer lugar com a Movr',
  subhead: 'Carros, okada e partilha — cobrados na sua moeda local.',
  pickupNow: 'Partida agora',
  share: 'Partilha · tarifa menor',
  pickupPlaceholder: 'Local de recolha',
  dropoffPlaceholder: 'Destino',
  seePrices: 'Ver preços',
  gettingPrices: 'A obter preços…',
  loginRecent: 'Inicie sessão para ver a atividade recente',
  openDashboard: 'Abrir painel',
  chooseRide: 'Escolher viagem',
  nearby: 'Perto',
  bestValue: 'Melhor valor',
  confirming: 'A confirmar…',
  loginToBook: 'Inicie sessão para reservar',
  request: 'Pedir',
  sideTitle: 'Pronto para viajar?',
  sideBody: 'Os mesmos rails da app Movr — cotação, partilha e matching de motorista.',
  sideCta: 'Criar conta',
  needDropoff: 'Indique um destino',
  noVehicles: 'Sem veículos para esta rota',
  quoteFailed: 'Não foi possível obter preços',
  pickVehicle: 'Escolha um veículo',
  booked: 'Viagem pedida — a procurar motorista',
  shareJoined: 'Veículo partilhado em matching',
  shareWaiting: 'Entrou no pool — à espera de passageiros',
  mapsHint: 'Adicione Google Maps em Integrações para pesquisa de moradas.',
  detecting: 'A detetar a sua cidade…',
  chargedIn: 'Preços em',
};

const AR: BookingCopy = {
  ...EN,
  changeCity: 'تغيير المدينة',
  headline: 'اذهب إلى أي مكان مع موفر',
  subhead: 'سيارات وأوكادا ورحلات مشتركة — بأسعار عملتك المحلية.',
  pickupNow: 'انطلاق الآن',
  share: 'مشاركة · أجرة أقل',
  pickupPlaceholder: 'موقع الانطلاق',
  dropoffPlaceholder: 'الوجهة',
  seePrices: 'عرض الأسعار',
  gettingPrices: 'جاري جلب الأسعار…',
  loginRecent: 'سجّل الدخول لرؤية نشاطك',
  openDashboard: 'فتح لوحة الرحلات',
  chooseRide: 'اختر رحلة',
  nearby: 'قريب',
  bestValue: 'أفضل قيمة',
  confirming: 'جاري التأكيد…',
  loginToBook: 'سجّل الدخول للحجز',
  request: 'اطلب',
  sideTitle: 'جاهز للسفر؟',
  sideBody: 'نفس نظام تطبيق موفر — تسعير ومشاركة ومطابقة السائق.',
  sideCta: 'إنشاء حساب',
  needDropoff: 'أدخل وجهة',
  noVehicles: 'لا توجد مركبات لهذا المسار',
  quoteFailed: 'تعذر جلب الأسعار',
  pickVehicle: 'اختر مركبة',
  booked: 'تم طلب الرحلة — جاري البحث عن سائق',
  shareJoined: 'مطابقة مركبة مشتركة',
  shareWaiting: 'انضممت للمجموعة — بانتظار ركاب',
  mapsHint: 'أضف خرائط Google في التكاملات لتمكين البحث عن العناوين.',
  detecting: 'جاري تحديد مدينتك…',
  chargedIn: 'الأسعار بـ',
};

const ES: BookingCopy = {
  ...EN,
  changeCity: 'Cambiar ciudad',
  headline: 'Ve a cualquier lugar con Movr',
  subhead: 'Coches, okada y viajes compartidos — en tu moneda local.',
  pickupNow: 'Recogida ahora',
  share: 'Compartir · tarifa más baja',
  pickupPlaceholder: 'Punto de recogida',
  dropoffPlaceholder: 'Destino',
  seePrices: 'Ver precios',
  gettingPrices: 'Obteniendo precios…',
  loginRecent: 'Inicia sesión para ver tu actividad',
  openDashboard: 'Abrir panel',
  chooseRide: 'Elige un viaje',
  nearby: 'Cerca',
  bestValue: 'Mejor valor',
  confirming: 'Confirmando…',
  loginToBook: 'Inicia sesión para reservar',
  request: 'Solicitar',
  sideTitle: '¿Listo para viajar?',
  sideBody: 'Los mismos rails que la app Movr — cotización, share y matching.',
  sideCta: 'Crear cuenta',
  needDropoff: 'Introduce un destino',
  noVehicles: 'No hay vehículos en esta ruta',
  quoteFailed: 'No se pudieron obtener precios',
  pickVehicle: 'Elige un vehículo',
  booked: 'Viaje solicitado — buscando conductor',
  shareJoined: 'Vehículo compartido en matching',
  shareWaiting: 'Unido al pool — esperando pasajeros',
  mapsHint: 'Añade Google Maps en Integraciones para buscar direcciones.',
  detecting: 'Detectando tu ciudad…',
  chargedIn: 'Precios en',
};

const BY_LANG: Record<string, BookingCopy> = {
  en: EN,
  fr: FR,
  pt: PT,
  ar: AR,
  es: ES,
};

export function bookingCopy(lang: string): BookingCopy {
  return BY_LANG[String(lang || 'en').slice(0, 2)] || EN;
}
