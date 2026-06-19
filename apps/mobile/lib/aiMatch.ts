interface Category { id: string; name: string; remote: boolean; keywords: string[] }

const CATS: Category[] = [
  {
    id: 'cleaning', name: 'Cleaning', remote: false,
    keywords: [
      'clean','cleaning','house clean','maid','sweep','mop','wash','scrub','sanitize','disinfect','tidy',
      'சுத்தம்','துப்புரவு','சுத்திகரிப்பு','துடை','அழி','துவை','சலவை',
      'පිරිසිදු','පිරිසිදු කිරීම','සෝදා','මොප්','කුණු','දූවිලි','සනීපාරක්ෂක',
    ],
  },
  {
    id: 'electrical', name: 'Electrical', remote: false,
    keywords: [
      'electric','electrical','wiring','wire','flash','fuse','circuit','switch','socket','light','fan','power','voltage','current','electrician',
      'மின்சார','மின்','வயரிங்','கம்பி','ஃபியூஸ்','சர்க்யூட்','சுவிட்ச்','சாக்கெட்','லைட்','விசிறி',
      'විදුලි','විදුලි කාර්මික','වයර්','වයරින්','ෆියුස්','පරිපථ','ස්විච්','සොකට්','සැකසුම්',
    ],
  },
  {
    id: 'plumbing', name: 'Plumbing', remote: false,
    keywords: [
      'plumb','plumbing','tap','pipe','leak','water','drain','sewer','faucet','toilet','sink','shower','bathroom','overflow','clog','plumber',
      'குழாய்','பிளம்பிங்','கசிவு','தண்ணீர்','வடிகால்','குளியலறை','கழிப்பறை','திறப்பு','சாக்கடை',
      'නල','ජලනල','කානු','කාන්දු','වතුර','ජලය','බේසම','වැසිකිළි','නාන කාමර','පිටාර',
    ],
  },
  {
    id: 'painting', name: 'Painting', remote: false,
    keywords: [
      'paint','painting','painter','wall','color','colour','coating','brush','roller','spray','primer','varnish','interior','exterior',
      'வண்ணம்','பெயிண்ட்','சாயம்','சுவர்','நிறம்','பூச்சு','தூரிகை',
      'තීන්ත','පාට','බිත්ති','වර්ණ','ආලේපන','බුරුසු','රෝලර්',
    ],
  },
  {
    id: 'moving', name: 'Moving', remote: false,
    keywords: [
      'move','moving','shift','relocate','transport','packing','cargo','loading','unloading','house moving','removal','shifting',
      'நகர்த்த','இடமாற்ற','நகர்வு','சுமை','ஏற்றி','இறக்கி','பார்சல்',
      'ගෙනයන්න','මාරු','ප්‍රවාහන','බඩු','පැකේජ','බාගන්න','උඩුගත',
    ],
  },
  {
    id: 'gardening', name: 'Gardening', remote: false,
    keywords: [
      'garden','gardening','lawn','grass','plants','tree','flower','landscape','yard','prune','weed','mow','trim','hedge',
      'தோட்டம்','தோட்ட வேலை','புல்','செடி','மரம்','மலர்','நில அமைப்பு','வெட்டு','களை',
      'උද්‍යාන','වත්ත','තණකොළ','පැල','ගස','මල්','භූමි අලංකරණ','මිදුල',
    ],
  },
  {
    id: 'repairs', name: 'Repairs', remote: false,
    keywords: [
      'repair','fix','broken','hammer','maintenance','restore','service','damage','mend','renew','renovate','handyman',
      'பழுது','சரி','உடைந்த','பராமரிப்பு','சேவை','சேதம்','புதுப்பி','ரிப்பேர்',
      'අළුත්වැඩියා','සවි','කැඩුණු','නඩත්තු','සේවා','හානි','ප්‍රතිසංස්කරණ',
    ],
  },
  {
    id: 'assembly', name: 'Assembly', remote: false,
    keywords: [
      'assembly','assemble','furniture','build','construct','install','set up','put together','ikea','flat pack','frame',
      'சட்டசபை','கூட்டு','தளபாடங்கள்','கட்டு','நிறுவு','அமை','ஒருங்கிணை',
      'එකලස්','ගෘහ භාණ්ඩ','සාදන්න','ඉදිකරන්න','ස්ථාපනය','සකස්',
    ],
  },
  {
    id: 'webdesign', name: 'Web Design', remote: true,
    keywords: [
      'web','website','webdesign','wbe desing','wbe design','ui ux','wordpress','landing','frontend','backend','fullstack','html','css','javascript','react','web dev','app dev','mobile app','site',
      'இணையதள','வலைதள','வலை வடிவமைப்பு','யுஐ','யுஎக்ஸ்','வேர்ட்பிரஸ்','லேண்டிங்',
      'වෙබ්','වෙබ් අඩවිය','වෙබ් නිර්මාණ','යූඅයි','යූඑක්ස්','වර්ඩ්ප්‍රෙස්','ගොඩබෑම',
    ],
  },
  {
    id: 'graphics', name: 'Graphic Design', remote: true,
    keywords: [
      'graphic','logo','poster','design','brand','flyer','banner','illustration','photoshop','illustrator','vector','brochure','business card','typography','social media post',
      'வரைகலை','லோகோ','சுவரொட்டி','வடிவமைப்பு','பிராண்ட்','ஃபிளையர்','பேனர்','இல்லஸ்ட்ரேஷன்',
      'ග්‍රැෆික්','ලාංඡනය','පෝස්ටරය','නිර්මාණ','වෙළඳ නාම','නිවේදන පත්‍රිකා','බැනරය',
    ],
  },
  {
    id: 'marketing', name: 'Marketing', remote: true,
    keywords: [
      'marketing','seo','social media','ads','facebook','instagram','tiktok','linkedin','digital marketing','content','influencer','campaign','analytics','growth','promotion',
      'சந்தைப்படுத்தல்','சமூக ஊடக','விளம்பரம்','ஃபேஸ்புக்','டிஜிட்டல்','உள்ளடக்கம்','பிரச்சாரம்',
      'අලෙවි','සමාජ මාධ්‍ය','දැන්වීම්','ෆේස්බුක්','ඩිජිටල් අලෙවි','අන්තර්ගත','ව්‍යාප්තිය',
    ],
  },
  {
    id: 'realestate', name: 'Real Estate', remote: false,
    keywords: [
      'house','apartment','rent','sale','property','land','bedroom','villa','condo','commercial','office','buy','sell','lease','mortgage','flat','home','studio',
      'வீடு','குடியிருப்பு','வாடகை','விற்பனை','சொத்து','நிலம்','படுக்கையறை','வில்லா','அலுவலகம்','வாங்க','விற்க',
      'නිවස','මහල් නිවාස','කුලියට','විකිණීම','දේපල','ඉඩම','නිදන කාමර','විලා','කාර්යාල','මිලදී','විකුණන්න',
    ],
  },
]

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
  return dp[m][n]
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF\u0B82-\u0BDF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTamil(text: string): boolean {
  return /[\u0B80-\u0BFF]/.test(text)
}

function isSinhala(text: string): boolean {
  return /[\u0D80-\u0DFF]/.test(text)
}

export function matchCategory(input: string) {
  const text = normalizeText(input)
  if (!text) return null

  let best: { cat: Category; score: number; keyword: string } | null = null

  for (const cat of CATS) {
    for (const kw of cat.keywords) {
      const normalizedKw = normalizeText(kw)

      if (text === normalizedKw) {
        if (!best || 100 > best.score) best = { cat, score: 100, keyword: kw }
        continue
      }

      if (text.length >= normalizedKw.length - 2 && text.length <= normalizedKw.length + 2) {
        const dist = levenshtein(text, normalizedKw)
        const sim = 1 - dist / Math.max(text.length, normalizedKw.length)
        const score = Math.round(sim * 100)
        if (sim > 0.7 && (!best || score > best.score))
          best = { cat, score, keyword: kw }
      }

      if (text.includes(normalizedKw)) {
        if (!best || 100 > best.score) best = { cat, score: 100, keyword: kw }
        continue
      }

      for (const word of text.split(/\s+/)) {
        if (word.length < 2) continue

        if (normalizedKw.includes(word)) {
          if (!best || 98 > best.score) best = { cat, score: 98, keyword: kw }
          continue
        }

        const kwParts = normalizedKw.split(/\s+/)
        for (const kwPart of kwParts) {
          if (word.length < 3 && kwPart.length < 3) continue
          const dist = levenshtein(word, kwPart)
          const sim = 1 - dist / Math.max(word.length, kwPart.length)
          const score = Math.round(sim * 94)
          if (sim > 0.65 && (!best || score > best.score))
            best = { cat, score, keyword: kw }
        }
      }
    }
  }

  if (!best || best.score < 55) return null

  return {
    categoryId: best.cat.id,
    categoryName: best.cat.name,
    isRemote: best.cat.remote,
    confidence: best.score,
    correctedText: best.score < 100 ? best.cat.name : undefined,
  }
}
