/**
 * All African Union member states — used for footer locale + country select fallbacks.
 * Primary language is the common UI/business language for that market.
 */
export type AfricaLocale = {
  country_code: string;
  country_name: string;
  language_code: string;
  language_label: string;
  currency_code: string;
  dial_code: string;
  display_label: string;
  is_default?: boolean;
};

const ROWS: Array<Omit<AfricaLocale, 'display_label' | 'is_default'> & { is_default?: boolean }> = [
  { country_code: 'DZ', country_name: 'Algeria', language_code: 'ar', language_label: 'Arabic', currency_code: 'DZD', dial_code: '+213' },
  { country_code: 'AO', country_name: 'Angola', language_code: 'pt', language_label: 'Portuguese', currency_code: 'AOA', dial_code: '+244' },
  { country_code: 'BJ', country_name: 'Benin', language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+229' },
  { country_code: 'BW', country_name: 'Botswana', language_code: 'en', language_label: 'English', currency_code: 'BWP', dial_code: '+267' },
  { country_code: 'BF', country_name: 'Burkina Faso', language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+226' },
  { country_code: 'BI', country_name: 'Burundi', language_code: 'fr', language_label: 'French', currency_code: 'BIF', dial_code: '+257' },
  { country_code: 'CV', country_name: 'Cabo Verde', language_code: 'pt', language_label: 'Portuguese', currency_code: 'CVE', dial_code: '+238' },
  { country_code: 'CM', country_name: 'Cameroon', language_code: 'fr', language_label: 'French', currency_code: 'XAF', dial_code: '+237' },
  { country_code: 'CF', country_name: 'Central African Republic', language_code: 'fr', language_label: 'French', currency_code: 'XAF', dial_code: '+236' },
  { country_code: 'TD', country_name: 'Chad', language_code: 'fr', language_label: 'French', currency_code: 'XAF', dial_code: '+235' },
  { country_code: 'KM', country_name: 'Comoros', language_code: 'fr', language_label: 'French', currency_code: 'KMF', dial_code: '+269' },
  { country_code: 'CG', country_name: 'Congo', language_code: 'fr', language_label: 'French', currency_code: 'XAF', dial_code: '+242' },
  { country_code: 'CD', country_name: 'Democratic Republic of the Congo', language_code: 'fr', language_label: 'French', currency_code: 'CDF', dial_code: '+243' },
  { country_code: 'CI', country_name: "Côte d'Ivoire", language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+225' },
  { country_code: 'DJ', country_name: 'Djibouti', language_code: 'fr', language_label: 'French', currency_code: 'DJF', dial_code: '+253' },
  { country_code: 'EG', country_name: 'Egypt', language_code: 'ar', language_label: 'Arabic', currency_code: 'EGP', dial_code: '+20' },
  { country_code: 'GQ', country_name: 'Equatorial Guinea', language_code: 'es', language_label: 'Spanish', currency_code: 'XAF', dial_code: '+240' },
  { country_code: 'ER', country_name: 'Eritrea', language_code: 'en', language_label: 'English', currency_code: 'ERN', dial_code: '+291' },
  { country_code: 'SZ', country_name: 'Eswatini', language_code: 'en', language_label: 'English', currency_code: 'SZL', dial_code: '+268' },
  { country_code: 'ET', country_name: 'Ethiopia', language_code: 'en', language_label: 'English', currency_code: 'ETB', dial_code: '+251' },
  { country_code: 'GA', country_name: 'Gabon', language_code: 'fr', language_label: 'French', currency_code: 'XAF', dial_code: '+241' },
  { country_code: 'GM', country_name: 'Gambia', language_code: 'en', language_label: 'English', currency_code: 'GMD', dial_code: '+220' },
  { country_code: 'GH', country_name: 'Ghana', language_code: 'en', language_label: 'English', currency_code: 'GHS', dial_code: '+233', is_default: true },
  { country_code: 'GN', country_name: 'Guinea', language_code: 'fr', language_label: 'French', currency_code: 'GNF', dial_code: '+224' },
  { country_code: 'GW', country_name: 'Guinea-Bissau', language_code: 'pt', language_label: 'Portuguese', currency_code: 'XOF', dial_code: '+245' },
  { country_code: 'KE', country_name: 'Kenya', language_code: 'en', language_label: 'English', currency_code: 'KES', dial_code: '+254' },
  { country_code: 'LS', country_name: 'Lesotho', language_code: 'en', language_label: 'English', currency_code: 'LSL', dial_code: '+266' },
  { country_code: 'LR', country_name: 'Liberia', language_code: 'en', language_label: 'English', currency_code: 'LRD', dial_code: '+231' },
  { country_code: 'LY', country_name: 'Libya', language_code: 'ar', language_label: 'Arabic', currency_code: 'LYD', dial_code: '+218' },
  { country_code: 'MG', country_name: 'Madagascar', language_code: 'fr', language_label: 'French', currency_code: 'MGA', dial_code: '+261' },
  { country_code: 'MW', country_name: 'Malawi', language_code: 'en', language_label: 'English', currency_code: 'MWK', dial_code: '+265' },
  { country_code: 'ML', country_name: 'Mali', language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+223' },
  { country_code: 'MR', country_name: 'Mauritania', language_code: 'ar', language_label: 'Arabic', currency_code: 'MRU', dial_code: '+222' },
  { country_code: 'MU', country_name: 'Mauritius', language_code: 'en', language_label: 'English', currency_code: 'MUR', dial_code: '+230' },
  { country_code: 'MA', country_name: 'Morocco', language_code: 'ar', language_label: 'Arabic', currency_code: 'MAD', dial_code: '+212' },
  { country_code: 'MZ', country_name: 'Mozambique', language_code: 'pt', language_label: 'Portuguese', currency_code: 'MZN', dial_code: '+258' },
  { country_code: 'NA', country_name: 'Namibia', language_code: 'en', language_label: 'English', currency_code: 'NAD', dial_code: '+264' },
  { country_code: 'NE', country_name: 'Niger', language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+227' },
  { country_code: 'NG', country_name: 'Nigeria', language_code: 'en', language_label: 'English', currency_code: 'NGN', dial_code: '+234' },
  { country_code: 'RW', country_name: 'Rwanda', language_code: 'en', language_label: 'English', currency_code: 'RWF', dial_code: '+250' },
  { country_code: 'ST', country_name: 'São Tomé and Príncipe', language_code: 'pt', language_label: 'Portuguese', currency_code: 'STN', dial_code: '+239' },
  { country_code: 'SN', country_name: 'Senegal', language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+221' },
  { country_code: 'SC', country_name: 'Seychelles', language_code: 'en', language_label: 'English', currency_code: 'SCR', dial_code: '+248' },
  { country_code: 'SL', country_name: 'Sierra Leone', language_code: 'en', language_label: 'English', currency_code: 'SLE', dial_code: '+232' },
  { country_code: 'SO', country_name: 'Somalia', language_code: 'en', language_label: 'English', currency_code: 'SOS', dial_code: '+252' },
  { country_code: 'ZA', country_name: 'South Africa', language_code: 'en', language_label: 'English', currency_code: 'ZAR', dial_code: '+27' },
  { country_code: 'SS', country_name: 'South Sudan', language_code: 'en', language_label: 'English', currency_code: 'SSP', dial_code: '+211' },
  { country_code: 'SD', country_name: 'Sudan', language_code: 'ar', language_label: 'Arabic', currency_code: 'SDG', dial_code: '+249' },
  { country_code: 'TZ', country_name: 'Tanzania', language_code: 'en', language_label: 'English', currency_code: 'TZS', dial_code: '+255' },
  { country_code: 'TG', country_name: 'Togo', language_code: 'fr', language_label: 'French', currency_code: 'XOF', dial_code: '+228' },
  { country_code: 'TN', country_name: 'Tunisia', language_code: 'ar', language_label: 'Arabic', currency_code: 'TND', dial_code: '+216' },
  { country_code: 'UG', country_name: 'Uganda', language_code: 'en', language_label: 'English', currency_code: 'UGX', dial_code: '+256' },
  { country_code: 'ZM', country_name: 'Zambia', language_code: 'en', language_label: 'English', currency_code: 'ZMW', dial_code: '+260' },
  { country_code: 'ZW', country_name: 'Zimbabwe', language_code: 'en', language_label: 'English', currency_code: 'USD', dial_code: '+263' },
];

export const AFRICA_LOCALES: AfricaLocale[] = ROWS.map((r) => ({
  ...r,
  display_label: `${r.country_name} - ${r.language_label}`,
  is_default: Boolean(r.is_default),
})).sort((a, b) => a.country_name.localeCompare(b.country_name));

export const AFRICA_COUNTRIES = AFRICA_LOCALES.map((r) => ({
  code: r.country_code,
  name: r.country_name,
  currencyCode: r.currency_code,
  dialCode: r.dial_code,
}));
