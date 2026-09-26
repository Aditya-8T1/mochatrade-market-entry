// Country flag for a market page. One size for every market (the parent
// sets it); flags are the flag-icons 4x3 SVGs, bundled by Vite so there is
// no network call. A market is matched by its ISO-3166 code: the 33 named
// markets by id, public-data screens by the iso3 in the screen file, and
// user-entered markets by the iso3 the country lookup stored. No match, no
// flag -- nothing is guessed.
import type { ReactElement } from "react";
import type { Market } from "../../engine/types";

const FLAG_URLS = import.meta.glob("/node_modules/flag-icons/flags/4x3/*.svg", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const ISO3_TO_ISO2: Record<string, string> = Object.fromEntries(
  "AFG:AF,ALA:AX,ALB:AL,DZA:DZ,ASM:AS,AND:AD,AGO:AO,AIA:AI,ATA:AQ,ATG:AG,ARG:AR,ARM:AM,ABW:AW,AUS:AU,AUT:AT,AZE:AZ,BHS:BS,BHR:BH,BGD:BD,BRB:BB,BLR:BY,BEL:BE,BLZ:BZ,BEN:BJ,BMU:BM,BTN:BT,BOL:BO,BES:BQ,BIH:BA,BWA:BW,BVT:BV,BRA:BR,IOT:IO,BRN:BN,BGR:BG,BFA:BF,BDI:BI,CPV:CV,KHM:KH,CMR:CM,CAN:CA,CYM:KY,CAF:CF,TCD:TD,CHL:CL,CHN:CN,CXR:CX,CCK:CC,COL:CO,COM:KM,COG:CG,COD:CD,COK:CK,CRI:CR,CIV:CI,HRV:HR,CUB:CU,CUW:CW,CYP:CY,CZE:CZ,DNK:DK,DJI:DJ,DMA:DM,DOM:DO,ECU:EC,EGY:EG,SLV:SV,GNQ:GQ,ERI:ER,EST:EE,SWZ:SZ,ETH:ET,FLK:FK,FRO:FO,FJI:FJ,FIN:FI,FRA:FR,GUF:GF,PYF:PF,ATF:TF,GAB:GA,GMB:GM,GEO:GE,DEU:DE,GHA:GH,GIB:GI,GRC:GR,GRL:GL,GRD:GD,GLP:GP,GUM:GU,GTM:GT,GGY:GG,GIN:GN,GNB:GW,GUY:GY,HTI:HT,HMD:HM,VAT:VA,HND:HN,HKG:HK,HUN:HU,ISL:IS,IND:IN,IDN:ID,IRN:IR,IRQ:IQ,IRL:IE,IMN:IM,ISR:IL,ITA:IT,JAM:JM,JPN:JP,JEY:JE,JOR:JO,KAZ:KZ,KEN:KE,KIR:KI,PRK:KP,KOR:KR,KWT:KW,KGZ:KG,LAO:LA,LVA:LV,LBN:LB,LSO:LS,LBR:LR,LBY:LY,LIE:LI,LTU:LT,LUX:LU,MAC:MO,MDG:MG,MWI:MW,MYS:MY,MDV:MV,MLI:ML,MLT:MT,MHL:MH,MTQ:MQ,MRT:MR,MUS:MU,MYT:YT,MEX:MX,FSM:FM,MDA:MD,MCO:MC,MNG:MN,MNE:ME,MSR:MS,MAR:MA,MOZ:MZ,MMR:MM,NAM:NA,NRU:NR,NPL:NP,NLD:NL,NCL:NC,NZL:NZ,NIC:NI,NER:NE,NGA:NG,NIU:NU,NFK:NF,MKD:MK,MNP:MP,NOR:NO,OMN:OM,PAK:PK,PLW:PW,PSE:PS,PAN:PA,PNG:PG,PRY:PY,PER:PE,PHL:PH,PCN:PN,POL:PL,PRT:PT,PRI:PR,QAT:QA,REU:RE,ROU:RO,RUS:RU,RWA:RW,BLM:BL,SHN:SH,KNA:KN,LCA:LC,MAF:MF,SPM:PM,VCT:VC,WSM:WS,SMR:SM,STP:ST,SAU:SA,SEN:SN,SRB:RS,SYC:SC,SLE:SL,SGP:SG,SXM:SX,SVK:SK,SVN:SI,SLB:SB,SOM:SO,ZAF:ZA,SGS:GS,SSD:SS,ESP:ES,LKA:LK,SDN:SD,SUR:SR,SJM:SJ,SWE:SE,CHE:CH,SYR:SY,TWN:TW,TJK:TJ,TZA:TZ,THA:TH,TLS:TL,TGO:TG,TKL:TK,TON:TO,TTO:TT,TUN:TN,TUR:TR,TKM:TM,TCA:TC,TUV:TV,UGA:UG,UKR:UA,ARE:AE,GBR:GB,USA:US,UMI:UM,URY:UY,UZB:UZ,VUT:VU,VEN:VE,VNM:VN,VGB:VG,VIR:VI,WLF:WF,ESH:EH,YEM:YE,ZMB:ZM,ZWE:ZW,XKX:XK".split(",").map((p) => p.split(":") as [string, string]),
);

/** ISO-3166 alpha-2 for the markets in data/markets.json and data/round2-research.json. */
const MARKET_ISO2: Record<string, string> = {
  uae: "ae", brazil: "br", indonesia: "id", philippines: "ph", nigeria: "ng", pakistan: "pk", thailand: "th", south_africa: "za", vietnam: "vn",
  el_salvador: "sv", kazakhstan: "kz", kenya: "ke", bahrain: "bh", peru: "pe", mexico: "mx", uruguay: "uy", mauritius: "mu", panama: "pa", georgia: "ge",
  argentina: "ar", chile: "cl", costa_rica: "cr", ghana: "gh", colombia: "co", malaysia: "my", turkey: "tr", oman: "om", ukraine: "ua", saudi_arabia: "sa",
  sri_lanka: "lk", morocco: "ma", bangladesh: "bd", egypt: "eg",
};

export function iso2ForMarket(market: Pick<Market, "id" | "iso3" | "country_facts">): string | null {
  const byId = MARKET_ISO2[market.id];
  if (byId) return byId;
  const iso3 = market.iso3 ?? market.country_facts?.iso3 ?? null;
  const iso2 = iso3 ? ISO3_TO_ISO2[iso3.toUpperCase()] : undefined;
  return iso2 ? iso2.toLowerCase() : null;
}

export function flagUrl(iso2: string): string | null {
  return FLAG_URLS[`/node_modules/flag-icons/flags/4x3/${iso2.toLowerCase()}.svg`] ?? null;
}

/** The flag, or nothing. Fixed aspect 4:3; size comes from className (default 48x36). */
export default function Flag({ market, className = "h-9 w-12" }: { market: Pick<Market, "id" | "name" | "iso3" | "country_facts">; className?: string }): ReactElement | null {
  const iso2 = iso2ForMarket(market);
  const url = iso2 ? flagUrl(iso2) : null;
  if (!url) return null;
  return (
    <img
      data-testid="market-flag"
      data-iso2={iso2}
      src={url}
      alt={`Flag of ${market.name}`}
      width={48}
      height={36}
      className={`shrink-0 rounded-[6px] object-cover shadow-card ring-1 ring-black/10 ${className}`}
    />
  );
}
