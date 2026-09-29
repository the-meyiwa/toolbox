/* ============================================================
   TOOLBOX — Cosmetics Database: brands

   Beauty and personal-care brands from around the world, with the
   country they come from, the group that owns them, the year they
   were founded (left blank where it is not well documented), what
   they make and where they sit in the market.

   id | name | country | parent group | founded | focus | tier
   focus: skincare, makeup, hair, body, fragrance, sun, oral, nails,
          men, baby, derm (dermatological)
   tier:  luxury, prestige, masstige, mass, pharmacy, professional, indie
   ============================================================ */

export const BRAND_ROWS = `
cerave | CeraVe | United States | L'Oréal | 2005 | skincare,body,sun | pharmacy
la-roche-posay | La Roche-Posay | France | L'Oréal | 1975 | skincare,sun,derm,body | pharmacy
vichy | Vichy | France | L'Oréal | 1931 | skincare,sun,body | pharmacy
skinceuticals | SkinCeuticals | United States | L'Oréal | 1994 | skincare,sun | prestige
loreal-paris | L'Oréal Paris | France | L'Oréal | 1909 | makeup,skincare,hair | mass
lancome | Lancôme | France | L'Oréal | 1935 | skincare,makeup,fragrance | luxury
kiehls | Kiehl's | United States | L'Oréal | 1851 | skincare,body,hair,men | prestige
maybelline | Maybelline New York | United States | L'Oréal | 1915 | makeup | mass
garnier | Garnier | France | L'Oréal | 1904 | hair,skincare,sun | mass
nyx | NYX Professional Makeup | United States | L'Oréal | 1999 | makeup | mass
urban-decay | Urban Decay | United States | L'Oréal | 1996 | makeup | prestige
it-cosmetics | IT Cosmetics | United States | L'Oréal | 2008 | makeup,skincare | prestige
ysl-beauty | YSL Beauté | France | L'Oréal | 1961 | makeup,fragrance,skincare | luxury
giorgio-armani-beauty | Armani Beauty | Italy | L'Oréal | | makeup,fragrance,skincare | luxury
kerastase | Kérastase | France | L'Oréal | 1964 | hair | professional
redken | Redken | United States | L'Oréal | 1960 | hair | professional
matrix | Matrix | United States | L'Oréal | 1980 | hair | professional
youth-to-the-people | Youth to the People | United States | L'Oréal | 2015 | skincare | prestige
aesop | Aesop | Australia | L'Oréal | 1987 | skincare,body,hair,fragrance | luxury
mixa | Mixa | France | L'Oréal | 1924 | skincare,body,baby | mass
dove | Dove | United Kingdom | Unilever | 1957 | body,hair,skincare | mass
vaseline | Vaseline | United States | Unilever | 1870 | body,skincare | mass
ponds | Pond's | United States | Unilever | 1846 | skincare | mass
axe | Axe (Lynx) | France | Unilever | 1983 | men,body,fragrance | mass
rexona | Rexona (Degree, Sure) | Australia | Unilever | 1908 | body | mass
sunsilk | Sunsilk | United Kingdom | Unilever | 1954 | hair | mass
tresemme | TRESemmé | United States | Unilever | 1947 | hair | mass
lux | Lux | United Kingdom | Unilever | 1925 | body | mass
simple | Simple | United Kingdom | Unilever | 1960 | skincare | mass
glow-and-lovely | Glow & Lovely | India | Hindustan Unilever | 1975 | skincare | mass
dermalogica | Dermalogica | United States | Unilever | 1986 | skincare | professional
paulas-choice | Paula's Choice | United States | Unilever | 1995 | skincare | prestige
tatcha | Tatcha | United States | Unilever | 2009 | skincare | luxury
hourglass | Hourglass | United States | Unilever | 2004 | makeup | luxury
closeup | Closeup | United States | Unilever | 1967 | oral | mass
pepsodent | Pepsodent | United States | Unilever | 1915 | oral | mass
nivea | NIVEA | Germany | Beiersdorf | 1911 | skincare,body,sun,men | mass
eucerin | Eucerin | Germany | Beiersdorf | 1900 | skincare,derm,sun,body | pharmacy
la-prairie | La Prairie | Switzerland | Beiersdorf | 1978 | skincare | luxury
labello | Labello | Germany | Beiersdorf | 1909 | skincare | mass
aquaphor | Aquaphor | United States | Beiersdorf | 1925 | skincare,body,baby | pharmacy
estee-lauder | Estée Lauder | United States | Estée Lauder Companies | 1946 | skincare,makeup,fragrance | prestige
clinique | Clinique | United States | Estée Lauder Companies | 1968 | skincare,makeup,men | prestige
mac | MAC Cosmetics | Canada | Estée Lauder Companies | 1984 | makeup | prestige
bobbi-brown | Bobbi Brown | United States | Estée Lauder Companies | 1991 | makeup,skincare | prestige
la-mer | La Mer | United States | Estée Lauder Companies | 1965 | skincare | luxury
origins | Origins | United States | Estée Lauder Companies | 1990 | skincare | prestige
the-ordinary | The Ordinary | Canada | DECIEM (Estée Lauder Companies) | 2016 | skincare,hair | mass
niod | NIOD | Canada | DECIEM (Estée Lauder Companies) | 2013 | skincare | prestige
too-faced | Too Faced | United States | Estée Lauder Companies | 1998 | makeup | prestige
smashbox | Smashbox | United States | Estée Lauder Companies | 1996 | makeup | prestige
aveda | Aveda | United States | Estée Lauder Companies | 1978 | hair,body | professional
tom-ford-beauty | Tom Ford Beauty | United States | Estée Lauder Companies | 2006 | fragrance,makeup | luxury
jo-malone | Jo Malone London | United Kingdom | Estée Lauder Companies | 1990 | fragrance,body | luxury
le-labo | Le Labo | United States | Estée Lauder Companies | 2006 | fragrance,body | luxury
dr-jart | Dr.Jart+ | South Korea | Estée Lauder Companies | 2004 | skincare | prestige
olay | Olay | South Africa | Procter & Gamble | 1952 | skincare,body | mass
sk-ii | SK-II | Japan | Procter & Gamble | 1980 | skincare | luxury
pantene | Pantene | Switzerland | Procter & Gamble | 1945 | hair | mass
head-and-shoulders | Head & Shoulders | United States | Procter & Gamble | 1961 | hair | mass
herbal-essences | Herbal Essences | United States | Procter & Gamble | 1971 | hair | mass
aussie | Aussie | Australia | Procter & Gamble | 1979 | hair | mass
old-spice | Old Spice | United States | Procter & Gamble | 1937 | men,body,fragrance | mass
secret | Secret | United States | Procter & Gamble | 1956 | body | mass
gillette | Gillette | United States | Procter & Gamble | 1901 | men | mass
crest | Crest | United States | Procter & Gamble | 1955 | oral | mass
oral-b | Oral-B | United States | Procter & Gamble | 1950 | oral | mass
first-aid-beauty | First Aid Beauty | United States | Procter & Gamble | 2009 | skincare | prestige
native | Native | United States | Procter & Gamble | 2015 | body,hair | mass
neutrogena | Neutrogena | United States | Kenvue | 1930 | skincare,sun,hair | mass
aveeno | Aveeno | United States | Kenvue | 1945 | skincare,body,baby | mass
johnsons | Johnson's | United States | Kenvue | 1886 | baby,body | mass
clean-and-clear | Clean & Clear | United States | Kenvue | 1957 | skincare | mass
listerine | Listerine | United States | Kenvue | 1879 | oral | mass
ogx | OGX | United States | Kenvue |  | hair | mass
le-petit-marseillais | Le Petit Marseillais | France | Kenvue | 1985 | body,hair | mass
colgate | Colgate | United States | Colgate-Palmolive | 1873 | oral | mass
palmolive | Palmolive | United States | Colgate-Palmolive | 1898 | body,hair | mass
elmex | elmex | Switzerland | Colgate-Palmolive | 1962 | oral | pharmacy
sanex | Sanex | Spain | Colgate-Palmolive | 1983 | body | mass
sensodyne | Sensodyne | United Kingdom | Haleon | 1961 | oral | pharmacy
parodontax | parodontax | Germany | Haleon |  | oral | pharmacy
chapstick | ChapStick | United States | Suave Brands | 1880 | skincare | mass
carmex | Carmex | United States | Carma Laboratories | 1937 | skincare | mass
cetaphil | Cetaphil | Canada | Galderma | 1947 | skincare,body,baby | pharmacy
differin | Differin | United States | Galderma | | skincare,derm | pharmacy
bioderma | Bioderma | France | NAOS | 1977 | skincare,sun,derm | pharmacy
avene | Avène | France | Pierre Fabre | 1990 | skincare,sun,derm | pharmacy
ducray | Ducray | France | Pierre Fabre | 1930 | hair,skincare,derm | pharmacy
klorane | Klorane | France | Pierre Fabre | 1965 | hair,body | pharmacy
uriage | Uriage | France | Uriage | 1992 | skincare,sun,derm | pharmacy
caudalie | Caudalie | France | Caudalie | 1995 | skincare,body | masstige
nuxe | Nuxe | France | Nuxe | 1957 | skincare,body | masstige
embryolisse | Embryolisse | France | Embryolisse | 1950 | skincare | pharmacy
filorga | Filorga | France | Colgate-Palmolive | 1978 | skincare | masstige
svr | SVR | France | SVR | 1962 | skincare,sun,derm | pharmacy
chanel | Chanel | France | Chanel | 1910 | fragrance,makeup,skincare | luxury
dior | Dior | France | LVMH | 1947 | fragrance,makeup,skincare | luxury
guerlain | Guerlain | France | LVMH | 1828 | fragrance,makeup,skincare | luxury
givenchy-beauty | Givenchy Beauty | France | LVMH | 1957 | fragrance,makeup | luxury
benefit | Benefit Cosmetics | United States | LVMH | 1976 | makeup | prestige
fenty-beauty | Fenty Beauty | United States | Kendo (LVMH) | 2017 | makeup,skincare | prestige
make-up-for-ever | Make Up For Ever | France | LVMH | 1984 | makeup | prestige
fresh | Fresh | United States | LVMH | 1991 | skincare | prestige
sephora-collection | Sephora Collection | France | LVMH | | makeup,skincare | masstige
kenzo-parfums | Kenzo Parfums | France | LVMH | 1988 | fragrance | luxury
maison-francis-kurkdjian | Maison Francis Kurkdjian | France | LVMH | 2009 | fragrance | luxury
hermes | Hermès Parfums | France | Hermès | | fragrance,makeup | luxury
clarins | Clarins | France | Clarins | 1954 | skincare,makeup,body | prestige
sisley | Sisley Paris | France | Sisley | 1976 | skincare,makeup,fragrance | luxury
lancaster | Lancaster | Monaco | Coty | 1946 | skincare,sun | prestige
coty | Coty | France | Coty | 1904 | fragrance | mass
covergirl | CoverGirl | United States | Coty | 1961 | makeup | mass
rimmel | Rimmel London | United Kingdom | Coty | 1834 | makeup | mass
max-factor | Max Factor | United States | Coty | 1909 | makeup | mass
sally-hansen | Sally Hansen | United States | Coty | 1946 | nails | mass
kylie-cosmetics | Kylie Cosmetics | United States | Coty | 2015 | makeup | masstige
hugo-boss-fragrances | Hugo Boss Fragrances | Germany | Coty (licence) | | fragrance,men | prestige
gucci-beauty | Gucci Beauty | Italy | Coty (licence) | | fragrance,makeup | luxury
burberry-beauty | Burberry Beauty | United Kingdom | Coty (licence) | | fragrance | luxury
calvin-klein-fragrances | Calvin Klein Fragrances | United States | Coty (licence) | | fragrance | prestige
revlon | Revlon | United States | Revlon | 1932 | makeup,hair,nails | mass
elizabeth-arden | Elizabeth Arden | United States | Revlon | 1910 | skincare,fragrance | prestige
almay | Almay | United States | Revlon | 1931 | makeup | mass
shiseido | Shiseido | Japan | Shiseido | 1872 | skincare,makeup,sun | prestige
cle-de-peau | Clé de Peau Beauté | Japan | Shiseido | 1982 | skincare,makeup | luxury
anessa | Anessa | Japan | Shiseido | 1992 | sun | masstige
nars | NARS | United States | Shiseido | 1994 | makeup | prestige
drunk-elephant | Drunk Elephant | United States | Shiseido | 2012 | skincare | prestige
elixir | Elixir | Japan | Shiseido | 1983 | skincare | masstige
senka | Senka | Japan | Fine Today |  | skincare | mass
kao-biore | Bioré | Japan | Kao | 1980 | skincare,sun | mass
curel | Curél | Japan | Kao | 1999 | skincare,derm | pharmacy
kanebo | Kanebo | Japan | Kao | 1936 | skincare,makeup | prestige
molton-brown | Molton Brown | United Kingdom | Kao | 1971 | body,fragrance | luxury
john-frieda | John Frieda | United Kingdom | Kao | 1990 | hair | mass
jergens | Jergens | United States | Kao | 1882 | body | mass
kose | KOSÉ | Japan | KOSÉ | 1946 | skincare,makeup | prestige
sekkisei | Sekkisei | Japan | KOSÉ | 1985 | skincare | prestige
tarte | Tarte | United States | KOSÉ | 1999 | makeup | prestige
hada-labo | Hada Labo | Japan | Rohto | 2004 | skincare | mass
melano-cc | Melano CC | Japan | Rohto |  | skincare | mass
skin-aqua | Skin Aqua | Japan | Rohto |  | sun | mass
dhc | DHC | Japan | DHC | 1972 | skincare | mass
shu-uemura | Shu Uemura | Japan | L'Oréal | 1967 | makeup,skincare | prestige
canmake | Canmake | Japan | Ida Laboratories | 1985 | makeup | mass
kate-tokyo | KATE | Japan | Kanebo (Kao) | 1997 | makeup | mass
suqqu | SUQQU | Japan | Kanebo (Kao) | 2003 | makeup | luxury
decorte | Decorté | Japan | KOSÉ | 1970 | skincare,makeup | luxury
fancl | FANCL | Japan | Kirin | 1980 | skincare | masstige
muji | MUJI | Japan | Ryohin Keikaku | 1980 | skincare | mass
amorepacific | Amorepacific | South Korea | Amorepacific | 1945 | skincare | luxury
sulwhasoo | Sulwhasoo | South Korea | Amorepacific | 1997 | skincare | luxury
laneige | Laneige | South Korea | Amorepacific | 1994 | skincare,makeup | masstige
innisfree | Innisfree | South Korea | Amorepacific | 2000 | skincare | mass
etude | Etude | South Korea | Amorepacific | 1985 | makeup,skincare | mass
iope | IOPE | South Korea | Amorepacific | 1984 | skincare | masstige
cosrx | COSRX | South Korea | Amorepacific | 2013 | skincare | mass
the-history-of-whoo | The History of Whoo | South Korea | LG H&H | 2003 | skincare | luxury
belif | belif | South Korea | LG H&H | 2010 | skincare | masstige
the-face-shop | The Face Shop | South Korea | LG H&H | 2003 | skincare,makeup | mass
missha | Missha | South Korea | Able C&C | 2000 | skincare,makeup | mass
some-by-mi | SOME BY MI | South Korea | SOME BY MI | 2016 | skincare | mass
beauty-of-joseon | Beauty of Joseon | South Korea | Goodai Global | 2016 | skincare,sun | mass
round-lab | Round Lab | South Korea | Round Lab | 2017 | skincare,sun | mass
anua | Anua | South Korea | The Pure Lotus | 2019 | skincare | mass
skin1004 | SKIN1004 | South Korea | Craver | 2014 | skincare,sun | mass
isntree | Isntree | South Korea | Isntree | 2017 | skincare,sun | mass
klairs | Klairs | South Korea | Wishtrend | 2010 | skincare | mass
purito | Purito | South Korea | Purito | 2015 | skincare,sun | mass
torriden | Torriden | South Korea | Torriden | 2015 | skincare | mass
medicube | Medicube | South Korea | APR | 2016 | skincare | mass
banila-co | Banila Co | South Korea | Banila Co | 2005 | skincare,makeup | mass
clio | CLIO | South Korea | CLIO | 1997 | makeup | mass
romand | rom&nd | South Korea | I'M Company | 2016 | makeup | mass
peripera | Peripera | South Korea | CLIO | 2005 | makeup | mass
mediheal | Mediheal | South Korea | L&P Cosmetic | 2009 | skincare | mass
holika-holika | Holika Holika | South Korea | Enprani | 2010 | skincare,makeup | mass
pyunkang-yul | Pyunkang Yul | South Korea | Pyunkang Yul | 2016 | skincare | mass
heimish | Heimish | South Korea | Heimish |  | skincare | mass
axis-y | AXIS-Y | South Korea | AXIS-Y | 2019 | skincare | mass
florasis | Florasis | China | Yige | 2017 | makeup | masstige
perfect-diary | Perfect Diary | China | Yatsen | 2017 | makeup | mass
proya | Proya | China | Proya | 2003 | skincare | mass
winona | Winona | China | Botanee | 2010 | skincare,derm | pharmacy
chando | Chando (Natural Beauty's Chando) | China | Jala Group | 2001 | skincare | mass
judydoll | Judydoll | China | Judydoll |  | makeup | mass
herborist | Herborist | China | Shanghai Jahwa | 1998 | skincare | masstige
lakme | Lakmé | India | Hindustan Unilever | 1952 | makeup,skincare | mass
himalaya | Himalaya Wellness | India | Himalaya | 1930 | skincare,hair,oral | mass
biotique | Biotique | India | Bio Veda Action Research | 1992 | skincare,hair | mass
forest-essentials | Forest Essentials | India | Forest Essentials (Estée Lauder minority) | 2000 | skincare,body | luxury
sugar-cosmetics | SUGAR Cosmetics | India | Vellvette Lifestyle | 2015 | makeup | mass
mamaearth | Mamaearth | India | Honasa Consumer | 2016 | skincare,hair,baby | mass
minimalist | Minimalist | India | Hindustan Unilever | 2020 | skincare | mass
dabur | Dabur | India | Dabur | 1884 | hair,oral,skincare | mass
parachute | Parachute | India | Marico |  | hair | mass
kama-ayurveda | Kama Ayurveda | India | Kama Ayurveda | 2002 | skincare,hair | masstige
patanjali | Patanjali | India | Patanjali Ayurved | 2006 | skincare,hair,oral | mass
natura | Natura | Brazil | Natura &Co | 1969 | skincare,fragrance,body | masstige
o-boticario | O Boticário | Brazil | Grupo Boticário | 1977 | fragrance,makeup,body | masstige
eudora | Eudora | Brazil | Grupo Boticário | 2011 | makeup,fragrance | mass
avon | Avon | United States | Natura &Co | 1886 | makeup,skincare,fragrance | mass
the-body-shop | The Body Shop | United Kingdom | Aurea | 1976 | body,skincare,hair | mass
sol-de-janeiro | Sol de Janeiro | United States | L'Occitane Group | 2015 | body,fragrance | prestige
loccitane | L'Occitane en Provence | France | L'Occitane Group | 1976 | body,skincare,fragrance | prestige
elemis | Elemis | United Kingdom | L'Occitane Group | 1989 | skincare | prestige
erborian | Erborian | France | L'Occitane Group | 2007 | skincare,makeup | prestige
natura-bisse | Natura Bissé | Spain | Natura Bissé | 1979 | skincare | luxury
isdin | ISDIN | Spain | ISDIN | 1975 | sun,skincare,derm | pharmacy
sesderma | Sesderma | Spain | Sesderma | 1989 | skincare | pharmacy
puig | Puig | Spain | Puig | 1914 | fragrance | prestige
carolina-herrera | Carolina Herrera Fragrances | Spain | Puig | 1988 | fragrance | luxury
paco-rabanne | Rabanne Fragrances | France | Puig | | fragrance | prestige
charlotte-tilbury | Charlotte Tilbury | United Kingdom | Puig | 2013 | makeup,skincare | prestige
byredo | Byredo | Sweden | Puig | 2006 | fragrance,makeup | luxury
kiko-milano | KIKO Milano | Italy | Percassi | 1997 | makeup | mass
collistar | Collistar | Italy | Collistar | 1983 | skincare,sun | masstige
acqua-di-parma | Acqua di Parma | Italy | LVMH | 1916 | fragrance | luxury
weleda | Weleda | Switzerland | Weleda | 1921 | skincare,body,baby | masstige
lavera | Lavera | Germany | Laverana | 1987 | skincare,makeup | mass
balea | Balea | Germany | dm-drogerie markt | 1995 | skincare,body,hair | mass
essence | essence | Germany | cosnova | 2002 | makeup | mass
catrice | Catrice | Germany | cosnova | 2004 | makeup | mass
sebamed | Sebamed | Germany | Sebapharma | 1967 | skincare,body,derm | pharmacy
schwarzkopf | Schwarzkopf | Germany | Henkel | 1898 | hair | mass
syoss | Syoss | Germany | Henkel | 2003 | hair | mass
dr-hauschka | Dr. Hauschka | Germany | WALA | 1967 | skincare | masstige
babor | Babor | Germany | Babor | 1956 | skincare | professional
wella | Wella | Germany | Wella Company | 1880 | hair | professional
ghd | ghd | United Kingdom | Wella Company | 2001 | hair | professional
opi | OPI | United States | Wella Company | 1981 | nails | professional
lumene | Lumene | Finland | Lumene | 1970 | skincare,makeup | mass
lixirskin | Lixirskin | United Kingdom | Lixirskin | 2019| skincare | indie
rituals | Rituals | Netherlands | Rituals | 2000 | body,fragrance | masstige
yves-rocher | Yves Rocher | France | Groupe Rocher | 1959 | skincare,body,fragrance | mass
bourjois | Bourjois | France | Coty | 1863 | makeup | mass
nuxe-bio | Nuxe Bio | France | Nuxe | | skincare | masstige
typology | Typology | France | Typology | 2019 | skincare | indie
diptyque | Diptyque | France | Manzanita Capital | 1961 | fragrance,body | luxury
creed | Creed | France | Kering Beauté |  | fragrance | luxury
lush | Lush | United Kingdom | Lush | 1995 | body,hair,skincare | mass
no7 | No7 | United Kingdom | Boots | 1935 | skincare,makeup | mass
soap-and-glory | Soap & Glory | United Kingdom | Boots | 2006 | body | mass
the-inkey-list | The INKEY List | United Kingdom | The INKEY List | 2018 | skincare | mass
revolution | Makeup Revolution | United Kingdom | Revolution Beauty | 2014 | makeup,skincare | mass
pixi | Pixi | United Kingdom | Pixi Beauty | 1999 | skincare,makeup | masstige
liz-earle | Liz Earle | United Kingdom | Liz Earle Beauty Co. | 1995 | skincare | masstige
pat-mcgrath | Pat McGrath Labs | United Kingdom | Pat McGrath Labs | 2015 | makeup | luxury
glossier | Glossier | United States | Glossier | 2014 | makeup,skincare | prestige
rare-beauty | Rare Beauty | United States | Rare Beauty | 2020 | makeup | prestige
huda-beauty | Huda Beauty | United Arab Emirates | Huda Beauty | 2013 | makeup | prestige
anastasia-beverly-hills | Anastasia Beverly Hills | United States | Anastasia Beverly Hills | 1997 | makeup | prestige
elf | e.l.f. Cosmetics | United States | e.l.f. Beauty | 2004 | makeup,skincare | mass
milani | Milani | United States | Milani | 2002 | makeup | mass
wet-n-wild | wet n wild | United States | Markwins | 1979 | makeup | mass
physicians-formula | Physicians Formula | United States | Markwins | 1937 | makeup | mass
laura-mercier | Laura Mercier | United States | Orveon Global | 1996 | makeup | prestige
kosas | Kosas | United States | Kosas | 2015 | makeup | prestige
ilia | ILIA | United States | ILIA | 2011 | makeup | prestige
rms-beauty | RMS Beauty | United States | RMS Beauty | 2009 | makeup | prestige
supergoop | Supergoop! | United States | Supergoop! | 2007 | sun | prestige
eltamd | EltaMD | United States | Colgate-Palmolive | 1988 | sun,skincare | pharmacy
blue-lizard | Blue Lizard | United States | Crown Laboratories |  | sun | pharmacy
banana-boat | Banana Boat | United States | Edgewell |  | sun | mass
hawaiian-tropic | Hawaiian Tropic | United States | Edgewell | 1969 | sun | mass
coppertone | Coppertone | United States | Beiersdorf | 1944 | sun | mass
sunday-riley | Sunday Riley | United States | Sunday Riley | 2009 | skincare | prestige
ole-henriksen | Ole Henriksen | United States | LVMH | 1975 | skincare | prestige
peter-thomas-roth | Peter Thomas Roth | United States | Peter Thomas Roth | 1993 | skincare | prestige
murad | Murad | United States | Unilever | 1989 | skincare | prestige
dr-dennis-gross | Dr. Dennis Gross | United States | Dr. Dennis Gross | 2000 | skincare | prestige
glow-recipe | Glow Recipe | United States | Glow Recipe | 2014 | skincare | prestige
summer-fridays | Summer Fridays | United States | Summer Fridays | 2018 | skincare | prestige
burts-bees | Burt's Bees | United States | Clorox | 1984 | skincare,body,baby | mass
eos | eos | United States | eos Products | 2006 | skincare,body | mass
st-ives | St. Ives | United States | Unilever | 1980 | skincare,body | mass
freeman | Freeman | United States | Freeman Beauty |  | skincare | mass
olaplex | Olaplex | United States | Olaplex | 2014 | hair | professional
moroccanoil | Moroccanoil | Israel | Moroccanoil | 2006 | hair | professional
briogeo | Briogeo | United States | Briogeo | 2013 | hair | prestige
shea-moisture | SheaMoisture | United States | Sundial Brands (Unilever) | 1991 | hair,body | mass
cantu | Cantu | United States | PDC Brands | 2003 | hair | mass
mielle | Mielle Organics | United States | Procter & Gamble | 2014 | hair | mass
carols-daughter | Carol's Daughter | United States | L'Oréal | 1993 | hair,body | mass
pattern-beauty | Pattern Beauty | United States | Pattern Beauty | 2019 | hair | prestige
dark-and-lovely | Dark and Lovely | United States | L'Oréal | 1971 | hair | mass
ors | ORS (Organic Root Stimulator) | United States | Namasté Laboratories | 1995 | hair | mass
zaron | Zaron Cosmetics | Nigeria | Zaron | 2006 | makeup,skincare | mass
house-of-tara | House of Tara | Nigeria | House of Tara International | 1998 | makeup | masstige
arami-essentials | Arami Essentials | Nigeria | Arami Essentials | 2015 | skincare,hair,body | indie
black-opal | Black Opal | United States | BioCosmetic Research Labs | 1994 | makeup,skincare | mass
iman | IMAN Cosmetics | United States | Iman Cosmetics | 1994 | makeup | mass
fashion-fair | Fashion Fair | United States | Fashion Fair | 1973 | makeup | masstige
juvia-place | Juvia's Place | United States | Juvia's Place | 2016 | makeup | mass
nubian-heritage | Nubian Heritage | United States | Sundial Brands (Unilever) | 1992 | body | mass
african-pride | African Pride | United States | Strength of Nature |  | hair | mass
tcb | TCB Naturals | United States | Strength of Nature | | hair | mass
skin-gourmet | Skin Gourmet | South Africa | Skin Gourmet | 2007 | skincare,body | indie
africology | Africology | South Africa | Africology | 2007 | skincare,body | masstige
bio-oil | Bio-Oil | South Africa | Union-Swiss | 1987 | body,skincare | mass
nyakio | Nyakio | United States | Nyakio | 2002 | skincare | prestige
arganicare | Arganicare | Morocco | Arganicare | | hair,body | mass
hemani | Hemani | Pakistan | Hemani | 1949 | hair,body | mass
golden-pearl | Golden Pearl | Pakistan | Golden Pearl | | skincare | mass
dermacol | Dermacol | Czech Republic | Dermacol | 1966 | makeup | mass
bielenda | Bielenda | Poland | Bielenda | 1990 | skincare | mass
ziaja | Ziaja | Poland | Ziaja | 1989 | skincare,body | mass
inglot | Inglot | Poland | Inglot | 1983 | makeup,nails | masstige
eveline | Eveline Cosmetics | Poland | Eveline | 1983 | skincare,makeup | mass
natura-siberica | Natura Siberica | Russia | Natura Siberica | 2008 | skincare,hair | mass
pure-line | Chistaya Liniya | Russia | Unilever | 1998 | skincare | mass
ahava | AHAVA | Israel | AHAVA | 1988 | skincare,body | masstige
jurlique | Jurlique | Australia | Jurlique | 1985 | skincare | prestige
sukin | Sukin | Australia | BWX | 2007 | skincare,body | mass
go-to | Go-To Skin Care | Australia | Go-To | 2014 | skincare | indie
ultra-violette | Ultra Violette | Australia | Ultra Violette | 2019 | sun | prestige
frank-body | Frank Body | Australia | Frank Body | 2013 | body | mass
lucas-papaw | Lucas' Papaw Ointment | Australia | Lucas' Papaw Remedies | 1906 | skincare | mass
antipodes | Antipodes | New Zealand | Antipodes | 2006 | skincare | masstige
trilogy | Trilogy | New Zealand | Trilogy | 2002 | skincare | masstige
rhode | Rhode | United States | e.l.f. Beauty | 2022 | skincare,makeup | prestige
tower-28 | Tower 28 | United States | Tower 28 | 2019 | makeup | prestige
milk-makeup | Milk Makeup | United States | Milk Makeup | 2016 | makeup | prestige
too-cool-for-school | Too Cool For School | South Korea | Too Cool For School | 2009 | makeup | mass
bioessence | Bio Essence | Singapore | Bio Essence | | skincare | mass
safi | Safi | Malaysia | Wipro Unza | 1996 | skincare | mass
wardah | Wardah | Indonesia | Paragon Technology and Innovation | 1995 | makeup,skincare | mass
make-over | Make Over | Indonesia | Paragon Technology and Innovation | 2010 | makeup | mass
somethinc | Somethinc | Indonesia | Somethinc | 2019 | skincare,makeup | mass
mistine | Mistine | Thailand | Better Way | 1988 | makeup,sun | mass
snail-white | Snailwhite | Thailand | Namu Life | | skincare | mass
arabian-oud | Arabian Oud | Saudi Arabia | Arabian Oud | 1982 | fragrance | prestige
ajmal | Ajmal Perfumes | United Arab Emirates | Ajmal | 1951 | fragrance | prestige
lattafa | Lattafa Perfumes | United Arab Emirates | Lattafa | 1980 | fragrance | mass
rasasi | Rasasi | United Arab Emirates | Rasasi | 1979 | fragrance | prestige
amouage | Amouage | Oman | Amouage | 1983 | fragrance | luxury
pinaud | Clubman Pinaud | United States | American International Industries | | men | mass
nivea-men | NIVEA MEN | Germany | Beiersdorf | 1980 | men | mass
bulldog | Bulldog Skincare | United Kingdom | Edgewell | 2007 | men | mass
harrys | Harry's | United States | Harry's | 2013 | men | mass
jack-black | Jack Black | United States | Edgewell | 2000 | men | prestige
essie | essie | United States | L'Oréal | 1981 | nails | mass
china-glaze | China Glaze | United States | Hub Distributing |  | nails | professional
zoya | Zoya | United States | Art of Beauty | 1986 | nails | masstige
mustela | Mustela | France | Laboratoires Expanscience | 1950 | baby,skincare | pharmacy
bepanthen | Bepanthen | Germany | Bayer | 1944 | baby,skincare | pharmacy
sudocrem | Sudocrem | Ireland | Teva | 1931 | baby,skincare | pharmacy
desitin | Desitin | United States | Kenvue | 1920 | baby | pharmacy
palmers | Palmer's | United States | E.T. Browne Drug Co. | 1840 | body,skincare | mass
gold-bond | Gold Bond | United States | Sanofi | 1908 | body | mass
vanicream | Vanicream | United States | Pharmaceutical Specialties | 1975 | skincare,derm | pharmacy
a-derma | A-Derma | France | Pierre Fabre | 1983 | skincare,derm | pharmacy
noreva | Noreva | France | Noreva |  | skincare,derm | pharmacy
dr-althea | Dr. Althea | South Korea | Dr. Althea |  | skincare | mass
`;
