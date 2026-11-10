# Builds map/data.json: the World Map's built-in content (Tradition of Excellence Book 1 pieces,
# composers, country cards, instrument origins). The "Map Songs" / "Map Composers" / "Map Countries"
# tabs in the Content Pool sheet override these once they have rows (ClosingScores.gs a=map).
# Titles and the book's own origin labels only — no music or lyrics.
# Facts checked 11/10/2026; keep them short, true and school-friendly.
import json, os

HOME = {"name": "Savannah, Georgia", "lat": 32.08, "lon": -81.09}

# place: lat, lon
P = {
    "London": (51.51, -0.13), "Bonn": (50.74, 7.10), "Vienna": (48.21, 16.37), "Salzburg": (47.81, 13.04),
    "Eisenach": (50.98, 10.32), "Leipzig": (51.34, 12.37), "Halle": (51.48, 11.97), "Hamburg": (53.55, 9.99),
    "Cologne": (50.94, 6.96), "Paris": (48.86, 2.35), "Votkinsk": (57.05, 54.0), "St. Petersburg": (59.94, 30.31),
    "Moscow": (55.76, 37.62), "Cheltenham": (51.90, -2.08), "Antwerp": (51.22, 4.40), "Washington, D.C.": (38.90, -77.04),
    "Pittsburgh": (40.44, -79.99), "Boston": (42.36, -71.06), "Melbourne": (-37.81, 144.96), "Geneva": (46.20, 6.14),
    "Wichita Falls, Texas": (33.91, -98.49), "New York City": (40.71, -74.01), "New Orleans": (29.95, -90.07),
    "Laredo, Texas": (27.51, -99.51), "Texas": (31.0, -99.3), "Naples": (40.85, 14.27), "Venice": (45.44, 12.33),
    "Veracruz": (19.17, -96.13), "Sydney": (-33.87, 151.21), "Ayrshire, Scotland": (55.45, -4.60), "Wales": (52.35, -3.75),
    "Quebec": (46.81, -71.21), "Savannah, Georgia": (32.08, -81.09), "Prague": (50.08, 14.44), "Olney, England": (52.15, -0.70),
    "Brooklyn, New York": (40.58, -73.95), "England": (52.6, -1.5), "Kingston, Jamaica": (18.0, -76.79),
    "Trinidad": (10.66, -61.51), "Yangtze River": (30.6, 114.3), "Moscow region": (55.76, 37.62), "Dinant": (50.26, 4.91),
    "Nuremberg": (49.45, 11.08), "Munich": (48.14, 11.58), "Berlin": (52.52, 13.40), "Florence": (43.77, 11.26),
    "Istanbul": (41.01, 28.98), "Guatemala": (15.5, -90.4), "Weimar": (50.98, 11.33), "Biebrich, Germany": (50.04, 8.23),
    "Versailles": (48.80, 2.13), "Germany": (51.1, 10.4), "Middle East": (33.3, 44.4),
}

def at(name):
    lat, lon = P[name]
    return {"place": name, "lat": lat, "lon": lon}

COMPOSERS = {
    "Tielman Susato": {"years": "c. 1500–c. 1562", "born": 1500, "era": "Renaissance", "country": "Belgium",
        "worked": at("Antwerp"), "fact": "A trumpet player and music publisher in Antwerp. He printed lots of dance music, including the Ronde in our book."},
    "Johann Schop": {"years": "c. 1590–1667", "born": 1590, "era": "Baroque", "country": "Germany",
        "worked": at("Hamburg"), "fact": "A violinist who worked in Hamburg. Bach later used Schop's melody in “Jesu, Joy of Man's Desiring.”"},
    "Jeremiah Clarke": {"years": "c. 1674–1707", "born": 1674, "era": "Baroque", "country": "United Kingdom",
        "worked": at("London"), "fact": "For many years his Trumpet Voluntary was printed under another composer's name: Henry Purcell."},
    "Johann Sebastian Bach": {"years": "1685–1750", "born": 1685, "era": "Baroque", "country": "Germany",
        "birth": at("Eisenach"), "worked": at("Leipzig"), "fact": "Bach's death in 1750 marks the end of the Baroque Period."},
    "George Frideric Handel": {"years": "1685–1759", "born": 1685, "era": "Baroque", "country": "United Kingdom",
        "birth": at("Halle"), "worked": at("London"), "fact": "Born in Germany, famous in England. His Water Music was played on a barge on the Thames River for King George I (1717)."},
    "Jean-Jacques Rousseau": {"years": "1712–1778", "born": 1712, "era": "Classical", "country": "France",
        "birth": at("Geneva"), "worked": at("Paris"), "fact": "Better known as a philosopher. A dance from his 1752 opera became the tune of “Go Tell Aunt Rhodie.”"},
    "Wolfgang Amadeus Mozart": {"years": "1756–1791", "born": 1756, "era": "Classical", "country": "Austria",
        "birth": at("Salzburg"), "worked": at("Vienna"), "fact": "A child prodigy: he toured Europe with his father, wrote his first symphony at 8 and his first opera at 12."},
    "Ludwig van Beethoven": {"years": "1770–1827", "born": 1770, "era": "Classical", "country": "Germany",
        "birth": at("Bonn"), "worked": at("Vienna"), "fact": "He was completely deaf when he wrote Symphony No. 9 (1824). His music bridges the Classical and Romantic Periods."},
    "Jacques Offenbach": {"years": "1819–1880", "born": 1819, "era": "Romantic", "country": "France",
        "birth": at("Cologne"), "worked": at("Paris"), "fact": "Born in Germany, he became a star in Paris. He was also a fine cellist."},
    "J. S. Pierpont": {"years": "1822–1893", "born": 1822, "era": "Romantic", "country": "United States of America",
        "birth": at("Boston"), "worked": at("Savannah, Georgia"), "fact": "He was music director at the Unitarian church right here in Savannah when “Jingle Bells” was published in 1857."},
    "Stephen Foster": {"years": "1826–1864", "born": 1826, "era": "Romantic", "country": "United States of America",
        "birth": at("Pittsburgh"), "fact": "America's first great popular songwriter, born on July 4, 1826: the 50th birthday of American independence."},
    "Peter Ilyich Tchaikovsky": {"years": "1840–1893", "born": 1840, "era": "Romantic", "country": "Russia",
        "birth": at("Votkinsk"), "worked": at("St. Petersburg"), "fact": "He studied to be a lawyer first. In 1891 he traveled to New York City for the opening of Carnegie Hall."},
    "John Philip Sousa": {"years": "1854–1932", "born": 1854, "era": "20th Century", "country": "United States of America",
        "birth": at("Washington, D.C."), "fact": "“The March King.” He led the U.S. Marine Band, and the sousaphone is named after him."},
    "Gustav Holst": {"years": "1874–1934", "born": 1874, "era": "20th Century", "country": "United Kingdom",
        "birth": at("Cheltenham"), "worked": at("London"), "fact": "He was a professional trombonist. His most famous piece is The Planets."},
    "Percy Grainger": {"years": "1882–1961", "born": 1882, "era": "20th Century", "country": "Australia",
        "birth": at("Melbourne"), "worked": at("London"), "fact": "Born in Australia, he collected English folk songs and later lived in the United States. His band pieces are band classics."},
    "Bruce Pearson": {"years": "born 1942", "born": 1942, "era": "Today", "country": "United States of America",
        "fact": "Played clarinet and saxophone (and baseball and hockey!) in college before becoming a music teacher, author, composer and conductor."},
    "Anne McGinty": {"years": "born 1945", "born": 1945, "era": "Today", "country": "United States of America",
        "fact": "One of the most prolific women composers of band music: more than 225 published pieces."},
    "David Bobrowitz": {"years": "born 1945", "born": 1945, "era": "Today", "country": "United States of America", "fact": ""},
    "Erin A. Watson": {"years": "born 1977", "born": 1977, "era": "Today", "country": "United States of America",
        "birth": at("Wichita Falls, Texas"), "fact": "Plays violin, piano and accordion, and studied with American composer Joan Tower."},
    "Ryan Nowlin": {"years": "born 1978", "born": 1978, "era": "Today", "country": "United States of America",
        "fact": "A composer, author and music teacher who also plays horn and sings. He co-wrote this book."},
}

def song(n, title, label, country, place=None, composer=None, fact="", also=None):
    s = {"n": n, "title": title, "label": label, "country": country, "composer": composer or "", "fact": fact, "yt": ""}
    if place:
        s.update(at(place))
    if also:
        s["also"] = also  # extra pins: [{place, lat, lon, why}]
    return s

def extra(place, why):
    d = at(place); d["why"] = why; return d

US, UK = "United States of America", "United Kingdom"
SONGS = [
    song("17", "Rain, Rain", "Traditional (English nursery rhyme)", UK, "England"),
    song("19", "Hot Cross Buns", "English Folk Song", UK, "England", fact="Once a street vendors' call for selling buns in England."),
    song("20", "Go Tell Aunt Rhodie", "American Folk Song", US, composer="Jean-Jacques Rousseau",
         fact="The tune is older than the song: it began as a dance in Rousseau's 1752 opera in France.",
         also=[extra("Paris", "where the tune began (Rousseau's opera, 1752)")]),
    song("22", "Little Robin Redbreast", "Traditional (English nursery rhyme)", UK, "England"),
    song("23", "Merrily We Roll Along", "Traditional (American)", US, fact="Same tune as “Mary Had a Little Lamb.”"),
    song("24", "Itsy Bitsy Spider", "Traditional (American)", US),
    song("25", "A La Rueda", "Spanish Folk Song", "Spain"),
    song("26", "Love Somebody", "Traditional (American)", US),
    song("27", "Good King Wenceslas", "Traditional English Carol", UK, "London",
         fact="English words (1853), a tune from a 1582 songbook printed for Finland, and a real duke of Bohemia (today's Czechia).",
         also=[extra("Prague", "Wenceslas was a real duke of Bohemia (today's Czechia) in the 900s")]),
    song("31", "Camptown Races", "Stephen Foster", US, "Pittsburgh", composer="Stephen Foster"),
    song("33", "London Bridge", "English Folk Song", UK, "London"),
    song("34", "The Frog's Song", "Japanese Folk Song", "Japan", fact="In Japan it's called “Kaeru no Uta” and is sung as a round."),
    song("38", "Shoo Fly", "American Folk Song", US),
    song("39", "Russian Folk Song", "Ludwig van Beethoven (a Russian folk tune)", "Russia", "Moscow region", composer="Ludwig van Beethoven"),
    song("40", "San Serení", "Puerto Rican Folk Song", "Puerto Rico"),
    song("Ens.", "Jingle Bells", "J. S. Pierpont", US, "Savannah, Georgia", composer="J. S. Pierpont",
         fact="Savannah has a historical marker for it! The sleigh rides in the song are from Massachusetts, where Pierpont grew up. It was also the first song ever played in space (Gemini 6, 1965).",
         also=[extra("Boston", "Pierpont grew up here; the song was published in Boston in 1857")]),
    song("Ens.", "Jolly Old St. Nicholas", "Traditional (American)", US),
    song("Ens.", "The Dreidel Song", "Jewish Folk Song", US, "New York City",
         fact="The English song “I Have a Little Dreidel” was written by Samuel Goldfarb in New York in the 1920s. A dreidel is a spinning top for Hanukkah."),
    song("Ens.", "Kwanzaa Celebration", "David Bobrowitz", US, composer="David Bobrowitz"),
    song("44", "Michael Finnegan", "Irish Folk Song", "Ireland"),
    song("52", "Now Let Me Fly", "American Spiritual", US, fact="Spirituals are religious folk songs created by enslaved African Americans in the 1700s and 1800s."),
    song("58", "Boil the Cabbage Down", "American Folk Song", US),
    song("59", "Bingo", "American Folk Song", US),
    song("64", "Theme from “Cambridge Overture”", "Anne McGinty", US, composer="Anne McGinty"),
    song("65", "I've Just Come From Sydney", "Australian Folk Song", "Australia", "Sydney"),
    song("66", "Carnival of Venice", "Italian Folk Song", "Italy", "Venice", fact="Venice's Carnival is famous for its masks. Many virtuosos have written show-off variations on this tune."),
    song("67", "Lullaby", "Welsh Folk Song", UK, "Wales"),
    song("68", "Ezekiel Saw the Wheel", "American Spiritual", US),
    song("70", "Streets of Laredo", "American Folk Song", US, "Laredo, Texas", fact="Laredo is a city in Texas on the Mexican border. It's a cowboy song."),
    song("71", "Donkey Riding", "Canadian Folk Song", "Canada"),
    song("72", "Theme from “The Nutcracker”", "Peter Ilyich Tchaikovsky", "Russia", "St. Petersburg", composer="Peter Ilyich Tchaikovsky",
         fact="The Nutcracker ballet first played in St. Petersburg in 1892. Now theaters everywhere perform it every December."),
    song("Solo", "The Good Life", "Ryan Nowlin", US, composer="Ryan Nowlin"),
    song("Band", "March Across the Seas", "Bruce Pearson & Ryan Nowlin", US, composer="Bruce Pearson"),
    song("Band", "Procession from “Water Music”", "George Frideric Handel", UK, "London", composer="George Frideric Handel",
         fact="Written for a royal boat party on the Thames River. The orchestra played on one barge while King George I listened from another."),
    song("Band", "Banana Boat Song", "Jamaican Folk Song", "Jamaica", "Kingston, Jamaica",
         fact="A work song sung by dock workers loading bananas onto ships at night, made world-famous by Harry Belafonte in 1956."),
    song("Band", "Indigo Rock", "Bruce Pearson & Ryan Nowlin", US, composer="Ryan Nowlin"),
    song("74", "“Werde munter”", "Johann Schop", "Germany", "Hamburg", composer="Johann Schop"),
    song("75", "Fais Dodo", "French Folk Song", "France", fact="“Fais dodo” is how French parents say “go to sleep” to little kids."),
    song("76", "Baroque March", "George Frideric Handel", UK, "London", composer="George Frideric Handel"),
    song("77", "La Bamba", "Mexican Folk Song", "Mexico", "Veracruz", fact="A wedding song from Veracruz, Mexico. Ritchie Valens made a rock-and-roll version a hit in 1958."),
    song("82", "Theme from “Orpheus in the Underworld”", "Jacques Offenbach", "France", "Paris", composer="Jacques Offenbach",
         fact="Its fastest section is the famous “can-can” dance music."),
    song("84", "Crescent Moon Rising", "Chinese Folk Song", "China"),
    song("90", "Santa Lucia", "Italian Folk Song", "Italy", "Naples", fact="A boat song about a harbor in Naples. In Sweden, it's sung on St. Lucia's Day every December 13."),
    song("96", "When the Saints Go Marching In", "American Spiritual", US, "New Orleans", fact="Often played in Dixieland jazz style, which began in New Orleans in the early 1900s."),
    song("97", "Musette", "Johann Sebastian Bach", "Germany", "Leipzig", composer="Johann Sebastian Bach"),
    song("98", "Bella Bimba", "Italian Folk Song", "Italy"),
    song("104", "Alouette", "French Canadian Folk Song", "Canada", "Quebec", fact="“Alouette” means “lark,” a kind of songbird."),
    song("105", "Ronde", "Tielman Susato", "Belgium", "Antwerp", composer="Tielman Susato"),
    song("109", "Theme from “The Red Balloon”", "Anne McGinty", US, composer="Anne McGinty"),
    song("110", "Trumpet Voluntary", "Jeremiah Clarke", UK, "London", composer="Jeremiah Clarke",
         fact="Also called “Prince of Denmark's March.” It was first written for harpsichord, and it's a favorite at weddings."),
    song("115", "In the Bleak Midwinter", "Gustav Holst", UK, "London", composer="Gustav Holst"),
    song("116", "Theme from “Symphony No. 9”", "Ludwig van Beethoven", "Austria", "Vienna", composer="Ludwig van Beethoven",
         fact="Called “Ode to Joy.” Beethoven was completely deaf when he wrote it, and it first played in Vienna in 1824."),
    song("118", "Lone Star Waltz", "Erin A. Watson", US, "Wichita Falls, Texas", composer="Erin A. Watson",
         fact="Texas is called the Lone Star State."),
    song("119", "Yangtze Boatman Chantey", "Chinese Folk Song", "China", "Yangtze River", fact="The Yangtze is the longest river in Asia."),
    song("121", "Mary Ann", "Calypso Song", "Trinidad and Tobago", "Trinidad",
         fact="Calypso began in Trinidad and Tobago in the early 1900s. It often features guitar, steel drums and other percussion."),
    song("122", "Happy Little Donkey", "American Folk Song", US),
    song("127", "Theme from “The Sleeping Beauty”", "Peter Ilyich Tchaikovsky", "Russia", "St. Petersburg", composer="Peter Ilyich Tchaikovsky"),
    song("128", "Amazing Grace", "American Folk Song", US,
         fact="The words were written by John Newton, an English minister, in the 1770s. The tune we sing (“New Britain”) is American.",
         also=[extra("Olney, England", "John Newton wrote the words here")]),
    song("130", "A Little Blue", "In the style of the blues", US, fact="The blues grew out of African American spirituals and work songs in the early 1900s. Blues melodies are usually 12 measures long."),
    song("131", "Classical Dance", "Wolfgang Amadeus Mozart", "Austria", "Vienna", composer="Wolfgang Amadeus Mozart"),
    song("133", "Sleeping Princess", "Swedish Folk Song", "Sweden"),
    song("134", "Samba-lêlê", "Brazilian Folk Song", "Brazil", fact="A children's song from Brazil, where samba is the sound of Carnival."),
    song("136", "Ye Banks and Braes o' Bonnie Doon", "Scottish Folk Song", UK, "Ayrshire, Scotland",
         fact="The words are by Robert Burns, Scotland's national poet. The Doon is a river in Ayrshire."),
    song("137", "Open the Door for Me!", "South African Folk Song", "South Africa"),
    song("138", "Shepherd's Hey", "English Folk Song", UK, "England", composer="Percy Grainger",
         fact="Percy Grainger's 1918 version for concert band is part of the band world's standard music."),
    song("139", "The Yellow Rose of Texas", "American Folk Song", US, "Texas"),
    song("140", "Manhattan Beach March", "John Philip Sousa", US, "Brooklyn, New York", composer="John Philip Sousa",
         fact="Named for a seaside resort in Brooklyn, New York, where Sousa's band played summer concerts."),
    song("Ens.", "Ecossaise for Military Band", "Ludwig van Beethoven", "Austria", "Vienna", composer="Ludwig van Beethoven",
         fact="Written in 1810. An écossaise is a lively dance; “military band” was an old name for a band like ours."),
    song("Band", "See, the Conquering Hero Comes", "George Frideric Handel", UK, "London", composer="George Frideric Handel",
         fact="From Judas Maccabaeus (1746), one of Handel's most famous oratorios."),
    song("Band", "Riverside March", "Ryan Nowlin", US, composer="Ryan Nowlin"),
    song("Solo", "German Dance", "Ludwig van Beethoven", "Austria", "Vienna", composer="Ludwig van Beethoven",
         fact="Written around 1795, when Beethoven was becoming famous in Vienna as a composer and pianist."),
]

# name -> continent, flag, hello, known for, fun fact, music fact
C = {}
def country(name, cont, flag, hello, known, fact, music=""):
    C[name] = {"cont": cont, "flag": flag, "hello": hello, "known": known, "fact": fact, "music": music}

country("United States of America", "North America", "🇺🇸", "Hello", "Jazz, rock and roll, national parks and marching bands",
        "The tune of “The Star-Spangled Banner” was a British song before Francis Scott Key wrote new words in 1814.",
        "Jazz was born in New Orleans in the early 1900s, and the blues grew up in the South.")
country("United Kingdom", "Europe", "🇬🇧", "Hello", "Big Ben, castles, the Beatles and tea",
        "The UK is four countries in one: England, Scotland, Wales and Northern Ireland.",
        "The Beatles came from Liverpool, England. Scotland is famous for bagpipes.")
country("Ireland", "Europe", "🇮🇪", "Dia duit", "Green hills, St. Patrick's Day and Irish dance",
        "The harp is Ireland's national symbol. It's even on Irish coins.",
        "Irish folk bands use the fiddle, tin whistle and a frame drum called the bodhrán.")
country("Germany", "Europe", "🇩🇪", "Hallo", "Castles, pretzels, the Black Forest and fast cars",
        "Johannes Gutenberg's printing press, made in Mainz around 1450, changed how the world shared books and music.",
        "Bach, Handel and Beethoven were all born in Germany. So were the clarinet and the tuba.")
country("Austria", "Europe", "🇦🇹", "Hallo", "The Alps, skiing and Vienna's music",
        "Vienna is called the “City of Music”: Mozart, Haydn and Beethoven all worked there.",
        "The waltz became the dance craze of Vienna. Johann Strauss II wrote “The Blue Danube.”")
country("France", "Europe", "🇫🇷", "Bonjour", "The Eiffel Tower, art museums and croissants",
        "The Eiffel Tower was built for a world's fair in 1889 and was supposed to be temporary.",
        "The oboe was developed at the French royal court in the 1600s.")
country("Italy", "Europe", "🇮🇹", "Ciao", "Pizza, pasta, Rome and the Leaning Tower of Pisa",
        "Most of our music words are Italian: piano, forte, allegro, crescendo, tempo…",
        "The piano was invented in Florence, Italy, around 1700.")
country("Spain", "Europe", "🇪🇸", "Hola", "Flamenco, soccer and paella",
        "Flamenco dancers and singers clap tricky rhythms called palmas.",
        "The modern classical guitar was developed in Spain in the 1800s.")
country("Russia", "Europe & Asia", "🇷🇺", "Privet", "The world's biggest country, ballet and snowy winters",
        "Russia stretches across 11 time zones.",
        "Tchaikovsky's ballets, like The Nutcracker, are performed all over the world.")
country("Japan", "Asia", "🇯🇵", "Konnichiwa", "Sushi, anime, video games and bullet trains",
        "Japan's bullet trains (Shinkansen) travel close to 200 miles per hour.",
        "Taiko drummers play huge drums using their whole bodies.")
country("China", "Asia", "🇨🇳", "Nǐ hǎo", "The Great Wall, giant pandas and Lunar New Year",
        "Paper and the compass were first invented in China.",
        "The erhu is a two-string Chinese fiddle played with a bow.")
country("Mexico", "North America", "🇲🇽", "Hola", "Tacos, ancient pyramids and Day of the Dead",
        "The Aztecs and Maya were drinking chocolate long before Europeans arrived.",
        "Mariachi bands play trumpets, violins and several sizes of guitar.")
country("Puerto Rico", "North America (Caribbean)", "🇵🇷", "Hola", "Beaches, the El Morro fortress and the coquí frog",
        "Puerto Rico is a U.S. territory, so people born there are U.S. citizens.",
        "Bomba and plena are Puerto Rican music styles built on drums and call-and-response singing.")
country("Jamaica", "North America (Caribbean)", "🇯🇲", "Wah gwaan", "Reggae, beaches and world-record sprinters",
        "Usain Bolt, the fastest sprinter ever timed, is from Jamaica.",
        "Reggae music, made famous by Bob Marley, comes from Jamaica.")
country("Trinidad and Tobago", "North America (Caribbean)", "🇹🇹", "Hello", "Carnival and the steel pan",
        "The first steel pans were made from old oil drums.",
        "Calypso and soca music both come from Trinidad and Tobago.")
country("Canada", "North America", "🇨🇦", "Hello / Bonjour", "Hockey, maple syrup and moose",
        "Canada has the longest coastline of any country in the world.",
        "In Quebec most people speak French. Songs like “Alouette” come from there.")
country("Australia", "Oceania", "🇦🇺", "G'day", "Kangaroos, koalas and the Sydney Opera House",
        "Australia is a country and a whole continent.",
        "The didgeridoo is an ancient wind instrument of Aboriginal Australians.")
country("Sweden", "Europe", "🇸🇪", "Hej", "ABBA, IKEA and the Northern Lights",
        "Sweden has an Ice Hotel that is rebuilt from river ice every winter.",
        "ABBA, one of the best-selling bands of all time, is from Sweden.")
country("Brazil", "South America", "🇧🇷", "Olá", "Soccer, the Amazon rainforest and Carnival",
        "Most of the Amazon rainforest is in Brazil.",
        "Samba drums power Brazil's giant Carnival parades.")
country("South Africa", "Africa", "🇿🇦", "Sawubona", "Safaris, Table Mountain and Nelson Mandela",
        "South Africa has 12 official languages.",
        "South African choirs are famous for rich harmony singing.")
country("Belgium", "Europe", "🇧🇪", "Hallo / Bonjour", "Chocolate, waffles and comic books",
        "Adolphe Sax, the inventor of the saxophone, was born in Dinant, Belgium.",
        "In the 1500s, Antwerp was a center for printing music.")
country("Finland", "Europe", "🇫🇮", "Hei", "Saunas, forests and about 188,000 lakes",
        "Finland is sometimes called the “Land of a Thousand Lakes,” but it really has far more.",
        "The tune of “Good King Wenceslas” was printed in Piae Cantiones, a 1582 songbook for Finland.")
country("Czechia", "Europe", "🇨🇿", "Ahoj", "Prague's castles and old bridges",
        "Good King Wenceslas was a real duke of Bohemia (today's Czechia) more than 1,000 years ago.",
        "Antonín Dvořák was Czech. He wrote his “New World” Symphony while living in America.")
country("Switzerland", "Europe", "🇨🇭", "Grüezi / Bonjour", "The Alps, chocolate and watches",
        "Switzerland has four official languages: German, French, Italian and Romansh.",
        "The alphorn is a long wooden horn once used to call across mountain valleys.")
country("Guatemala", "North America (Central)", "🇬🇹", "Hola", "Mayan pyramids and volcanoes",
        "Tikal, an ancient Maya city, rises out of Guatemala's rainforest.",
        "The marimba is Guatemala's national instrument.")
country("Turkey", "Europe & Asia", "🇹🇷", "Merhaba", "Istanbul, bazaars and Turkish delight",
        "Istanbul is a city on two continents, Europe and Asia.",
        "The Zildjian cymbal company started in Istanbul in 1623 and still makes cymbals today.")
country("Cuba", "North America (Caribbean)", "🇨🇺", "Hola", "Old classic cars and Caribbean beaches",
        "Cuba is the largest island in the Caribbean.",
        "Cuban son music, a mix of Spanish and African sounds, helped give the world salsa.")
country("Argentina", "South America", "🇦🇷", "Hola", "Tango, soccer and the Andes mountains",
        "Aconcagua in Argentina is the tallest mountain in the world outside Asia.",
        "The tango was born in Buenos Aires.")
country("Indonesia", "Asia", "🇮🇩", "Halo", "Thousands of islands and Komodo dragons",
        "Indonesia has more than 17,000 islands.",
        "Gamelan orchestras play gongs and metal xylophones together.")
country("India", "Asia", "🇮🇳", "Namaste", "The Taj Mahal, cricket and spicy food",
        "India has more people than any other country.",
        "The sitar has many extra strings that ring along on their own when other strings are played.")
country("Egypt", "Africa", "🇪🇬", "Ahlan", "The pyramids and the Nile River",
        "The Great Pyramid was the tallest building on Earth for about 3,800 years.",
        "Ancient Egyptians played harps, flutes and a rattle called a sistrum.")
country("Kenya", "Africa", "🇰🇪", "Jambo", "Safaris and world-class distance runners",
        "Kenyan runners have won many Olympic medals in long-distance races.",
        "")
country("Ghana", "Africa", "🇬🇭", "Akwaaba (welcome)", "Kente cloth and gold",
        "In 1957 Ghana became the first country south of the Sahara to win independence from colonial rule.",
        "Talking drums can copy the rise and fall of spoken words.")
country("Mali", "Africa", "🇲🇱", "I ni ce", "The ancient city of Timbuktu",
        "Timbuktu was once a great center of learning with huge libraries of handwritten books.",
        "Griots are storytelling musicians. Many play the kora, a 21-string harp.")
country("New Zealand", "Oceania", "🇳🇿", "Kia ora", "Mountains, kiwi birds and the Māori haka",
        "There are more sheep than people in New Zealand.",
        "The haka is a Māori dance with chanting, stamping and strong voices.")
country("Norway", "Europe", "🇳🇴", "Hei", "Fjords, Vikings and the midnight sun",
        "In northern Norway the sun doesn't set at all for weeks in summer.",
        "Edvard Grieg, from Norway, wrote “In the Hall of the Mountain King.”")
country("Iceland", "Europe", "🇮🇸", "Halló", "Volcanoes, glaciers and hot springs",
        "Iceland has no mosquitoes.",
        "")
country("Netherlands", "Europe", "🇳🇱", "Hallo", "Tulips, windmills and bicycles",
        "About a quarter of the Netherlands is below sea level.",
        "")
country("Portugal", "Europe", "🇵🇹", "Olá", "Explorers, beaches and blue tiles",
        "Ferdinand Magellan, a Portuguese explorer, led the first voyage around the world (his crew finished it).",
        "Fado is a soulful song style from Lisbon.")
country("Greece", "Europe", "🇬🇷", "Yia sou", "Ancient temples, myths and islands",
        "The Olympic Games began in ancient Greece about 2,800 years ago.",
        "The word “music” comes from the Muses, the Greek goddesses of the arts.")
country("Poland", "Europe", "🇵🇱", "Cześć", "Pierogi and the old city of Kraków",
        "Marie Curie, the first person to win two Nobel Prizes, was born in Warsaw.",
        "Composer and pianist Frédéric Chopin was born in Poland.")
country("Hungary", "Europe", "🇭🇺", "Szia", "Budapest and the Danube River",
        "The Rubik's Cube was invented in Hungary in 1974.",
        "Composer Béla Bartók traveled to villages to record Hungarian folk songs.")
country("South Korea", "Asia", "🇰🇷", "Annyeonghaseyo", "K-pop, kimchi and taekwondo",
        "Korea's alphabet, Hangul, was created in the 1440s.",
        "K-pop groups are known for their tightly practiced dance routines.")
country("Peru", "South America", "🇵🇪", "Hola", "Machu Picchu and llamas",
        "Machu Picchu is an Inca city built high in the Andes mountains in the 1400s.",
        "Andean bands play panpipes and the charango, a small guitar.")
country("Mongolia", "Asia", "🇲🇳", "Sain baina uu", "Horses, yurts and the Gobi Desert",
        "Mongolia has more horses than people.",
        "Mongolian throat singers can sing two notes at the same time.")
country("Nepal", "Asia", "🇳🇵", "Namaste", "Mount Everest, the world's tallest mountain",
        "Nepal's flag is the only national flag that isn't a rectangle.",
        "")
country("Madagascar", "Africa", "🇲🇬", "Salama", "Lemurs and baobab trees",
        "Lemurs live in the wild only on Madagascar.",
        "The valiha is a tube-shaped string instrument made from bamboo.")
country("Venezuela", "South America", "🇻🇪", "Hola", "Angel Falls and the Andes",
        "Angel Falls is the world's tallest waterfall.",
        "El Sistema, a free youth orchestra program that inspired programs around the world, started in Venezuela in 1975.")
country("Colombia", "South America", "🇨🇴", "Hola", "Coffee, emeralds and colorful towns",
        "Colombia has coasts on both the Pacific Ocean and the Caribbean Sea.",
        "Cumbia music began on Colombia's Caribbean coast.")
country("Philippines", "Asia", "🇵🇭", "Kumusta", "Islands, beaches and jeepneys",
        "The Philippines has more than 7,000 islands.",
        "")
country("Thailand", "Asia", "🇹🇭", "Sawasdee", "Temples, elephants and street food",
        "Thailand is the only country in Southeast Asia that was never ruled by a European power.",
        "")
country("Vietnam", "Asia", "🇻🇳", "Xin chào", "Ha Long Bay and rice paddies",
        "Ha Long Bay has about 1,600 limestone islands.",
        "The đàn bầu has just one string. Players bend its pitch with a flexible rod.")
country("Nigeria", "Africa", "🇳🇬", "Hello", "Nollywood movies and big cities",
        "Nigeria has the most people of any country in Africa.",
        "Afrobeat music was created by Nigerian musician Fela Kuti.")
country("Morocco", "Africa", "🇲🇦", "Salam", "Markets, deserts and the Atlas Mountains",
        "The University of al-Qarawiyyin in Fez, founded in 859, is often called the oldest university still open.",
        "Gnawa musicians play the guembri, a three-string bass lute.")
country("Ethiopia", "Africa", "🇪🇹", "Selam", "Coffee and ancient churches carved from rock",
        "Coffee plants first grew wild in Ethiopia.",
        "")
country("Chile", "South America", "🇨🇱", "Hola", "The Andes and Easter Island's giant statues",
        "The Atacama Desert in Chile is one of the driest places on Earth.",
        "")
country("Ukraine", "Europe", "🇺🇦", "Pryvit", "Sunflower fields and painted eggs",
        "Ukraine is the largest country entirely in Europe.",
        "The melody of “Carol of the Bells” comes from a Ukrainian folk chant called “Shchedryk.”")
country("Tanzania", "Africa", "🇹🇿", "Jambo", "Mount Kilimanjaro and the Serengeti",
        "Mount Kilimanjaro is the tallest mountain in Africa.",
        "")

INSTRUMENTS = [
    {"name": "Flute", "emoji": "🎶", **at("Munich"), "when": "1847 (modern flute)",
     "fact": "Theobald Böhm designed the modern metal flute in Munich. Flutes carved from bird and mammoth bones, found in German caves, are more than 35,000 years old."},
    {"name": "Oboe", "emoji": "🎵", **at("Versailles"), "when": "mid-1600s",
     "fact": "The oboe was developed by musicians at the French royal court. Its name comes from the French “hautbois”: high wood."},
    {"name": "Clarinet", "emoji": "🎵", **at("Nuremberg"), "when": "about 1700",
     "fact": "Johann Christoph Denner of Nuremberg improved an older instrument called the chalumeau and created the clarinet."},
    {"name": "Bassoon", "emoji": "🎵", **at("Biebrich, Germany"), "when": "1800s (modern bassoon)",
     "fact": "The bassoon grew out of the dulcian of the 1500s. The Heckel family workshop in Biebrich, Germany, shaped the bassoon most players use today."},
    {"name": "Saxophone", "emoji": "🎷", **at("Paris"), "when": "1846",
     "fact": "Adolphe Sax was born in Dinant, Belgium, and patented the saxophone in Paris in 1846. He wanted an instrument with the power of brass and the agility of woodwinds.",
     "also": [extra("Dinant", "Adolphe Sax was born here")]},
    {"name": "Trumpet (valves)", "emoji": "🎺", **at("Berlin"), "when": "1818",
     "fact": "Valves were patented in 1818 by Heinrich Stölzel and Friedrich Blühmel in Prussia (Germany). Before valves, trumpets could play only a few notes."},
    {"name": "French Horn", "emoji": "📯", **at("Germany"), "when": "1800s (valve horn)",
     "fact": "Hunting horns were popular in France, but the valve horn we play was developed in Germany. In many countries it's just called “horn.”"},
    {"name": "Trombone", "emoji": "🎵", **at("Nuremberg"), "when": "1400s–1500s",
     "fact": "The trombone began as the sackbut. Nuremberg's brass makers were famous for them in the 1500s, and the slide works the same way today."},
    {"name": "Euphonium & Tuba", "emoji": "🎵", **at("Berlin"), "when": "1835 (tuba)",
     "fact": "Wilhelm Wieprecht and Johann Moritz patented the bass tuba in Berlin in 1835. The euphonium followed in Germany in the 1840s."},
    {"name": "Cymbals", "emoji": "🥁", **at("Istanbul"), "when": "1623 (Zildjian)",
     "fact": "The Zildjian family began making cymbals in Istanbul in 1623 using a secret metal recipe. The company still makes cymbals today, now in Massachusetts."},
    {"name": "Timpani", "emoji": "🥁", **at("Middle East"), "when": "1200s–1400s",
     "fact": "Kettledrums came to Europe from the Middle East, often played on horseback with trumpets."},
    {"name": "Marimba", "emoji": "🎼", **at("Guatemala"), "when": "centuries old",
     "fact": "The marimba has African roots and became Guatemala's national instrument."},
    {"name": "Piano", "emoji": "🎹", **at("Florence"), "when": "about 1700",
     "fact": "Bartolomeo Cristofori invented the piano in Florence. Its full name, pianoforte, means it can play soft and loud."},
    {"name": "Steel Pan", "emoji": "🥁", **at("Trinidad"), "when": "1930s–1940s",
     "fact": "Invented in Trinidad and Tobago from oil drums. Pan players tune each note by hammering the metal."},
]

ERAS = [
    {"name": "Renaissance", "from": 1400, "to": 1600},
    {"name": "Baroque", "from": 1600, "to": 1750},
    {"name": "Classical", "from": 1750, "to": 1820},
    {"name": "Romantic", "from": 1820, "to": 1900},
    {"name": "20th Century", "from": 1900, "to": 2000},
    {"name": "Today", "from": 2000, "to": 2030},
]

out = {"v": 1, "home": HOME, "eras": ERAS, "composers": COMPOSERS, "songs": SONGS, "countries": C, "instruments": INSTRUMENTS}
here = os.path.dirname(os.path.abspath(__file__))
dest = os.path.join(here, "..", "..", "map", "data.json")
with open(dest, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print("songs", len(SONGS), "composers", len(COMPOSERS), "countries", len(C), "instruments", len(INSTRUMENTS))
