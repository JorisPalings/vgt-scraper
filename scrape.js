import fs from 'fs'

const categoriesResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/categories')
const categories = await categoriesResponse.json()
const handshapesResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/handshapes')
const handshapes = await handshapesResponse.json()
const locationsResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/locations')
const locations = await locationsResponse.json()
const regionsResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/regions')
const regions = await regionsResponse.json()

let signs = []
await Promise.all(categories.map(async (category) => {
    console.log(`Scraping category '${category.id}' ...`)
    const categorySignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=["${category.id}"]&from=0&g=[]&h=[]&l=[]&lb=[]&mode=ORFuzzy&q=[]&r=[]&size=9999`)
    const categorySigns = await categorySignsResponse.json()
    console.log(`Category '${category.id}' contains ${categorySigns.signOverviews.length} signs`)
    signs.push(categorySigns.signOverviews.map(sign => {
        delete sign.labels
        return sign
    }))
}))
await Promise.all(handshapes.map(async (handshape) => {
    console.log(`Scraping handshape '${handshape.name}' ...`)
    const handshapeSignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=[]&from=0&g=[]&h=["${handshape.name}"]&l=[]&lb=[]&mode=ORFuzzy&q=[]&r=[]&size=9999`)
    const handshapeSigns = await handshapeSignsResponse.json()
    console.log(`Handshape '${handshape.name}' contains ${handshapeSigns.signOverviews.length} signs`)
    signs.push(handshapeSigns.signOverviews.map(sign => {
        delete sign.labels
        return sign
    }))
}))
await Promise.all(locations.map(async (location) => {
    console.log(`Scraping location '${location.id}' ...`)
    const locationSignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=[]&from=0&g=[]&h=[]&l=["${location.id}"]&lb=[]&mode=ORFuzzy&q=[]&r=[]&size=9999`)
    const locationSigns = await locationSignsResponse.json()
    console.log(`Location '${location.id}' contains ${locationSigns.signOverviews.length} signs`)
    signs.push(locationSigns.signOverviews.map(sign => {
        delete sign.labels
        return sign
    }))
}))
await Promise.all(regions.map(async (region) => {
    console.log(`Scraping region '${region.id}' ...`)
    const regionSignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=[]&from=0&g=[]&h=[]&l=[]&lb=[]&mode=ORFuzzy&q=[]&r=["${region.id}"]&size=9999`)
    const regionSigns = await regionSignsResponse.json()
    console.log(`Region '${region.id}' contains ${regionSigns.signOverviews.length} signs`)
    signs.push(regionSigns.signOverviews.map(sign => {
        delete sign.labels
        return sign
    }))
}))
signs = signs.flat()

console.log(`Found ${signs.length} signs`)
console.log('Deduping signs...')
let uniqueSigns = signs.filter((sign, index, self) =>
    index === self.findIndex(s => s.signId === sign.signId)
)
console.log(`Found ${uniqueSigns.length} unique signs`)

// Human readable format
fs.writeFileSync('signs.json', JSON.stringify(uniqueSigns, null, '\t'))

// Minify .json file
uniqueSigns = uniqueSigns.map(sign => {
    return {
        g: sign.glossName,
		r: sign.regions
            .map(region => region.replace(/Vlaanderen|Vlaams/, 'Vl.')),
		s: sign.signId,
		t: sign.translations,
		v: sign.video
            .replace('https://vlaamsegebarentaal.be/signbank/dictionary/protected_media/glossvideo/', '')
            .replace(`-${sign.signId}.mp4`, '')
        // Video URL = https://vlaamsegebarentaal.be/signbank/dictionary/protected_media/glossvideo/ + [INITIALS + / + VIDEO-ID] + sign.signId + .mp4
    }
})
fs.writeFileSync('signs.min.json', JSON.stringify(uniqueSigns)) // Minified
