import json

LINKS = {
    13: "https://www.getyourguide.com/ubud-l32246/ubud-campuhan-ridge-walk-tegallalang-rice-terrace-more-t890889/",
    17: "https://www.getyourguide.com/celuk-l166278/bali-make-your-own-silver-jewelry-gold-plated-option-t523518/",
    23: "https://www.getyourguide.com/bali-l347/ubud-3-hour-traditional-balinese-painting-class-t308993/",
    29: "https://www.klook.com/en-US/activity/73710-surfing-lesson-seminyak-nuna-surfing-school-bali/",
    38: "https://www.getyourguide.com/seminyak-l95096/surfing-lessons-tc59/",
    48: "https://www.klook.com/en-US/destination/p50139894-uluwatu-beach/",
    49: "https://www.klook.com/en-US/destination/p50139894-uluwatu-beach/",
    50: "https://www.klook.com/en-US/destination/p50139894-uluwatu-beach/",
    51: "https://www.klook.com/en-US/destination/p50139894-uluwatu-beach/",
    52: "https://www.klook.com/activity/174682-surfing-lesson-for-all-levels-in-uluwatu-bali/",
    53: "https://www.klook.com/en-US/activity/89772-sundays-beach-club-pass-ungasan-bali/",
    56: "https://www.klook.com/en-US/destination/p50120819-melasti-beach/",
    57: "https://www.klook.com/en-US/destination/p50139894-uluwatu-beach/",
    60: "https://www.singlefinbali.com/",
    65: "https://www.getyourguide.com/nusa-penida-l89276/",
    67: "https://www.getyourguide.com/en-gb/banjar-hot-spring-l166256/",
    69: "https://www.getyourguide.com/singaraja-l90981/jumping-sliding-at-aling-aling-waterfall-handara-gate-lunch-t626993/",
    70: "https://www.getyourguide.com/banyumala-waterfalls-l90978/",
    71: "https://www.getyourguide.com/ulun-danu-bratan-temple-l91023/",
    72: "https://www.getyourguide.com/jatiluwih-rice-terrace-l161374/",
    73: "https://www.getyourguide.com/handara-iconic-gate-l91818/day-trips-tc172/",
    74: "https://www.getyourguide.com/gitgit-waterfall-l90972/",
    79: "https://www.klook.com/en-US/activity/50148-kebun-raya-bali-ticket-bali/",
    81: "https://www.getyourguide.com/kuta-district-l194358/sunset-tours-tc306/",
    82: "https://www.getyourguide.com/kuta-district-l194358/dinner-tours-tc309/",
    87: "https://www.klook.com/en-US/activity/90952-gili-trawangan-snorkeling-experience-in-lombok/",
    88: "https://www.klook.com/en-US/activity/171-devdan-show-bali/",
    89: "https://www.getyourguide.com/bali-l347/bali-private-car-and-minibus-charter-with-driver-t111028/",
}
PLATFORM = {
    17: "GetYourGuide", 23: "GetYourGuide", 29: "Klook", 38: "GetYourGuide",
    53: "Klook", 79: "Klook", 87: "Klook", 88: "Klook", 89: "GetYourGuide",
}

d = json.load(open('data/activities.json'))
for a in d['activities']:
    aid = a['id']
    if aid in LINKS:
        a['bookingLink'] = LINKS[aid]
        if aid in PLATFORM:
            a['platform'] = PLATFORM[aid]

json.dump(d, open('data/activities.json','w'), indent=1, ensure_ascii=False)

# verify no placeholders remain
bad = [ (a['id'], a['name'], a['bookingLink']) for a in d['activities']
        if 'goo.gl' in a.get('bookingLink','') or a.get('bookingLink','').endswith('getyourguide.com/') or a.get('bookingLink','') in ('https://www.getyourguide.com/','https://www.viator.com/')]
print('remaining placeholders:', bad)
