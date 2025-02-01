import fs from 'fs'

console.time('Total time')

const regionsResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/regions')
const regions = await regionsResponse.json() // 10.895
const locationsResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/locations')
const locations = await locationsResponse.json() // 10.794
const handshapesResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/handshapes')
const handshapes = await handshapesResponse.json() // 10.746
const categoriesResponse = await fetch('https://woordenboek.vlaamsegebarentaal.be/api/categories')
const categories = await categoriesResponse.json() // 10.358

// Scrape signs by regions, locations, categories and handshapes ==============
let signs = []
await Promise.all(regions.map(async (region) => {
    console.log(`Scraping region '${region.id}' ...`)
    const regionSignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=[]&from=0&g=[]&h=[]&l=[]&lb=[]&mode=ANDExact&q=[]&r=["${region.id}"]&size=9999`)
    const regionSigns = await regionSignsResponse.json()
    console.log(`Region '${region.id}' contains ${regionSigns.signOverviews.length} signs`)
    signs.push(regionSigns.signOverviews.map(sign => {
        delete sign.labels
        return sign // No need to explicitly add regions since those are always included
    }))
}))
await Promise.all(locations.map(async (location) => {
    console.log(`Scraping location '${location.id}' ...`)
    const locationSignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=[]&from=0&g=[]&h=[]&l=["${location.id}"]&lb=[]&mode=ANDExact&q=[]&r=[]&size=9999`)
    const locationSigns = await locationSignsResponse.json()
    console.log(`Location '${location.id}' contains ${locationSigns.signOverviews.length} signs`)
    signs.push(locationSigns.signOverviews.map(sign => {
        delete sign.labels
        return {
            ...sign,
            locations: [location.name]
        }
    }))
}))
await Promise.all(handshapes.map(async (handshape) => {
    console.log(`Scraping handshape '${handshape.name}' ...`)
    const encodedHandshapeName = handshape.name
        .replace(';', '%3B')
        .replace('^', '%5E')
        .replace('+', '%2B')
        .replace('"', '%5C"')
    const handshapeSignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=[]&from=0&g=[]&h=["${encodedHandshapeName}"]&l=[]&lb=[]&mode=ANDExact&q=[]&r=[]&size=9999`)
    try {
        const handshapeSigns = await handshapeSignsResponse.json()
        console.log(`Handshape '${handshape.name}' contains ${handshapeSigns.signOverviews.length} signs`)
        signs.push(handshapeSigns.signOverviews.map(sign => {
            delete sign.labels
            return {
                ...sign,
                handshapes: [handshape.name]
            }
        }))
    } catch(error) {
        console.error('Error scraping handshape', handshape.name, error)
    }
}))
await Promise.all(categories.map(async (category) => {
    console.log(`Scraping category '${category.id}' ...`)
    const categorySignsResponse = await fetch(`https://woordenboek.vlaamsegebarentaal.be/api/signs?c=["${category.id}"]&from=0&g=[]&h=[]&l=[]&lb=[]&mode=ANDExact&q=[]&r=[]&size=9999`)
    const categorySigns = await categorySignsResponse.json()
    console.log(`Category '${category.id}' contains ${categorySigns.signOverviews.length} signs`)
    signs.push(categorySigns.signOverviews.map(sign => {
        delete sign.labels
        return {
            ...sign,
            categories: [category.name]
        }
    }))
}))
signs = signs.flat()
console.log(`Found ${signs.length} signs`)

// Merge signs ================================================================
console.log('Merging signs by signId ...')
signs = signs.reduce((fullSigns, partialSign) => {
    let existingSignIndex = fullSigns.findIndex(fullSign => fullSign.signId === partialSign.signId)
    if(existingSignIndex === -1) {
        fullSigns.push(partialSign)
    } else {
        let existingSign = fullSigns[existingSignIndex]
        if(partialSign.locations) {
            if(existingSign.locations) {
                existingSign.locations = [...existingSign.locations, ...partialSign.locations]
            } else {
                existingSign.locations = [...partialSign.locations]
            }
        }
        if(partialSign.categories) {
            if(existingSign.categories) {
                existingSign.categories = [...existingSign.categories, ...partialSign.categories]
            } else {
                existingSign.categories = [...partialSign.categories]
            }
        }
        if(partialSign.handshapes) {
            if(existingSign.handshapes) {
                existingSign.handshapes = [...existingSign.handshapes, ...partialSign.handshapes]
            } else {
                existingSign.handshapes = [...partialSign.handshapes]
            }
        }
        fullSigns[existingSignIndex] = existingSign
    }
    return fullSigns
}, [])
console.log(`${signs.length} unique signs remain after merging`)

// Group matching signs by glossName ==========================================
console.log(`Grouping ${signs.length} signs by glossName ...`)
const glossNames = signs.map(sign => sign.glossName)
const uniqueGlossNames = glossNames.filter((glossName, index, self) =>
    index === self.findIndex(g => g === glossName)
)
signs = uniqueGlossNames.map(glossName => {
    const matchingSigns = signs.filter(sign => sign.glossName === glossName)
    return {
        g: glossName,
        // c: matchingSigns.map(sign => sign.categories)[0],
        t: matchingSigns.map(sign => sign.translations)[0],
        s: matchingSigns.map(sign => {
            return {
                id: sign.signId,
                r: sign.regions.map(region => {
                        if(region === 'Vlaanderen') return '*'
                        if(region === 'Antwerpen') return 'A'
                        if(region === 'Oost-Vlaanderen') return 'O'
                        if(region === 'West-Vlaanderen') return 'W'
                        if(region === 'Vlaams-Brabant') return 'V'
                        if(region === 'Limburg') return 'L'
                        if(region === 'Unknown') return '?'
                    }).sort(),
                // l: sign.locations ? sign.locations : [],
                // h: sign.handshapes ? sign.handshapes : [],
                v: sign.video.replace('https://vlaamsegebarentaal.be/signbank/dictionary/protected_media/glossvideo/', '')
                    .replace(`-${sign.signId}.mp4`, '')
            }
        })
    }
})
console.log(`${signs.length} signs remain after grouping signs by glossName`)

// Sort regional signs by total region population =============================
console.log('Sorting signs by region(s) ...')
signs = signs.map(sign => {
    sign.s = sign.s.sort((signA, signB) => {
        const regionWeights = { '*': 6821770, 'A': 1926522, 'O': 1572002, 'W': 1226375, 'V': 1196773, 'L': 900098, '?': 0 }
        const signARegions = signA.r.reduce((totalWeight, region) => totalWeight + regionWeights[region], 0)
        const signBRegions = signB.r.reduce((totalWeight, region) => totalWeight + regionWeights[region], 0)
        return signBRegions - signARegions
    })
    return sign
})
console.log('Sorted signs by region(s)')

// Randomize sign order =======================================================
console.log('Randomizing sign order ...')
for (let i = signs.length - 1; i > 0; i --) {
    let j = Math.floor(Math.random() * (i + 1));
    [signs[i], signs[j]] = [signs[j], signs[i]] // Swap using destructuring
}
console.log('Randomized sign order')

// Write minified file ========================================================
fs.writeFileSync('signs.min.json', JSON.stringify(signs))

console.timeEnd('Total time')