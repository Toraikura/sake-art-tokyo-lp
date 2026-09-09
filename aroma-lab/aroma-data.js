(function(){
  'use strict';
  const ASSET='../assets/aroma-lab/';
  const icons=[
    ['alcohol-sake','aroma-alcohol-sake.png','酒・アルコール','ALCOHOL'],
    ['aonori','aroma-aonori.png','青海苔','AONORI'],
    ['apple-green','aroma-apple-green.png','青リンゴ','GREEN APPLE'],
    ['apple-red','aroma-apple-red.png','リンゴ','APPLE'],
    ['banana','aroma-banana.png','バナナ','BANANA'],
    ['cabbage','aroma-cabbage.png','キャベツ','CABBAGE'],
    ['caramel','aroma-caramel.png','カラメル','CARAMEL'],
    ['cardboard-old-paper','aroma-cardboard-old-paper.png','段ボール・古紙','CARDBOARD / OLD PAPER'],
    ['cheese','aroma-cheese.png','チーズ','CHEESE'],
    ['clove','aroma-clove.png','クローブ','CLOVE'],
    ['cooking-oil','aroma-cooking-oil.png','油','OIL'],
    ['cork','aroma-cork.png','コルク','CORK'],
    ['corn-soup','aroma-corn-soup.png','コーンスープ','CORN SOUP'],
    ['corn','aroma-corn.png','コーン','CORN'],
    ['fermented-butter','aroma-fermented-butter.png','発酵バター','FERMENTED BUTTER'],
    ['gas','aroma-gas.png','ガス','GAS'],
    ['ginkgo-nut','aroma-ginkgo-nut.png','銀杏','GINKGO NUT'],
    ['glue-remover','aroma-glue-remover.png','接着剤・除光液','GLUE / NAIL POLISH REMOVER'],
    ['grapefruit','aroma-grapefruit.png','グレープフルーツ','GRAPEFRUIT'],
    ['grass','aroma-grass.png','草','GRASS'],
    ['green-aldehydic','aroma-green-aldehydic.png','青臭い・アルデヒド系','GREEN / ALDEHYDIC'],
    ['green-pepper','aroma-green-pepper.png','ピーマン','GREEN PEPPER'],
    ['honey','aroma-honey.png','蜂蜜','HONEY'],
    ['ink','aroma-ink.png','インク','INK'],
    ['kerosene','aroma-kerosene.png','灯油','KEROSENE'],
    ['lavender','aroma-lavender.png','ラベンダー','LAVENDER'],
    ['match-sulfite','aroma-match-sulfite.png','マッチ・亜硫酸','MATCH / SULFITE'],
    ['mold','aroma-mold.png','カビ','MOLD'],
    ['mouse','aroma-mouse.png','ネズミ臭','MOUSEY'],
    ['mureka-musty-steam','aroma-mureka-musty-steam.png','ムレ香','MURE / MUSTY STEAM'],
    ['mushroom','aroma-mushroom.png','キノコ','MUSHROOM'],
    ['natto','aroma-natto.png','納豆','NATTO'],
    ['nuts','aroma-nuts.png','ナッツ','NUTS'],
    ['oak-barrel','aroma-oak-barrel.png','オーク樽','OAK BARREL'],
    ['onion','aroma-onion.png','玉ねぎ','ONION'],
    ['phenol','aroma-phenol.png','フェノール','PHENOL'],
    ['pickles','aroma-pickles.png','漬物','PICKLES'],
    ['plastic','aroma-plastic.png','プラスチック','PLASTIC'],
    ['resin','aroma-resin.png','樹脂','RESIN'],
    ['rose','aroma-rose.png','バラ','ROSE'],
    ['rotten-egg','aroma-rotten-egg.png','腐った卵','ROTTEN EGG'],
    ['skunk','aroma-skunk.png','スカンク','SKUNK'],
    ['smoke','aroma-smoke.png','煙','SMOKE'],
    ['smoked','aroma-smoked.png','燻製','SMOKED'],
    ['smoky-charred','aroma-smoky-charred.png','焦げ','CHARRED'],
    ['soap','aroma-soap.png','石鹸','SOAP'],
    ['soil','aroma-soil.png','土','SOIL'],
    ['solvent','aroma-solvent.png','溶剤','SOLVENT'],
    ['spice','aroma-spice.png','香辛料','SPICE'],
    ['stable-animal','aroma-stable-animal.png','馬小屋・獣臭','STABLE / ANIMAL'],
    ['strawberry-candy','aroma-strawberry-candy.png','イチゴキャンディ','STRAWBERRY CANDY'],
    ['sweat','aroma-sweat.png','汗','SWEAT'],
    ['sweet-flower','aroma-sweet-flower.png','甘い花','SWEET FLOWER'],
    ['takuan','aroma-takuan.png','たくあん','TAKUAN'],
    ['vanilla','aroma-vanilla.png','バニラ','VANILLA'],
    ['vinegar','aroma-vinegar.png','酢','VINEGAR'],
    ['violet','aroma-violet.png','スミレ','VIOLET'],
    ['whiteboard-marker','aroma-whiteboard-marker.png','ホワイトボードマーカー','WHITEBOARD MARKER'],
    ['yogurt','aroma-yogurt.png','ヨーグルト','YOGURT'],
    ['young-green-leaves','aroma-young-green-leaves.png','青葉','YOUNG GREEN LEAVES']
  ].map(([id,file,ja,en])=>({id,file,src:ASSET+file,ja,en}));
  const iconById=Object.fromEntries(icons.map(x=>[x.id,x]));
  const groups=[
    {id:'fruit',label:'01 / FRUIT',icons:['banana','apple-red','apple-green','strawberry-candy','grapefruit']},
    {id:'flower',label:'02 / FLOWER & SWEET',icons:['rose','violet','lavender','sweet-flower','honey','vanilla']},
    {id:'spice-dairy',label:'03 / SPICE · DAIRY · ROAST',icons:['clove','spice','caramel','nuts','fermented-butter','yogurt','cheese','ginkgo-nut','oak-barrel']},
    {id:'plant-food',label:'04 / PLANT · VEGETABLE · FOOD',icons:['grass','young-green-leaves','green-aldehydic','green-pepper','aonori','corn','corn-soup','takuan','pickles','natto','cabbage','mushroom','onion']},
    {id:'chemical',label:'05 / CHEMICAL',icons:['alcohol-sake','vinegar','glue-remover','whiteboard-marker','solvent','ink','soap','cooking-oil','resin','plastic','phenol']},
    {id:'smoke-off',label:'06 / SMOKE · REDUCTION · OFF NOTE',icons:['kerosene','smoke','smoked','smoky-charred','match-sulfite','gas','rotten-egg','mold','cork','cardboard-old-paper']},
    {id:'earth-animal',label:'07 / EARTH · ANIMAL',icons:['mureka-musty-steam','sweat','stable-animal','mouse','soil','skunk']}
  ];
  const drinks={
    sake:{label:'SAKE',ja:'日本酒',title:'日本酒の香り',kicker:'SAKE / 19 STANDARDS'},
    shochu:{label:'SHOCHU',ja:'焼酎・泡盛',title:'焼酎・泡盛の香り',kicker:'SHOCHU & AWAMORI / 20 STANDARDS'},
    wine:{label:'WINE',ja:'ワイン',title:'ワインの香り',kicker:'WINE / STANDARD + PROFESSIONAL'},
    beer:{label:'BEER',ja:'ビール',title:'ビールの香り',kicker:'BEER / 17 STANDARDS'},
    cross:{label:'CROSS',ja:'酒をまたぐ',title:'酒をまたぐ同じ分子',kicker:'CROSS-DRINK / SAME MOLECULE, DIFFERENT GLASS'}
  };
  const compounds=[]; const byId={};
  function add(id,ja,en,family,aroma,iconIds,query=en,note=''){
    const x={id,ja,en,family,aroma,iconIds:Array.isArray(iconIds)?iconIds:[iconIds],query,note,apps:[]};
    compounds.push(x);byId[id]=x;return x;
  }
  function app(id,drink,no,set='main'){byId[id].apps.push({drink,no,set});}
  add('ethyl-acetate','酢酸エチル','Ethyl acetate','ESTER','接着剤・除光液 / 溶剤',['glue-remover','solvent']);
  add('isoamyl-acetate','酢酸イソアミル','Isoamyl acetate','ESTER','バナナ / 吟醸香',['banana']);
  add('ethyl-hexanoate','カプロン酸エチル','Ethyl hexanoate','ESTER','リンゴ / 吟醸香',['apple-red'],'ethyl hexanoate');
  add('ethanol','エタノール','Ethanol','ALCOHOL','酒・アルコール',['alcohol-sake']);
  add('isoamyl-alcohol','イソアミルアルコール','Isoamyl alcohol','ALCOHOL','ホワイトボードマーカー / インク',['whiteboard-marker','ink'],'3-methyl-1-butanol','清酒標準試薬では「高級アルコール」。SDS記載の実成分を表示。');
  add('phenethyl-alcohol','フェネチルアルコール','2-Phenylethanol','ALCOHOL','バラ / 甘い花',['rose','sweet-flower'],'2-phenylethanol');
  add('acetaldehyde','アセトアルデヒド','Acetaldehyde','ALDEHYDE','青リンゴ / 青臭い・アルデヒド系',['apple-green','green-aldehydic']);
  add('isovaleraldehyde','イソバレルアルデヒド','3-Methylbutanal','ALDEHYDE','ムレ香 / 刺激的',['mureka-musty-steam'],'3-methylbutanal');
  add('4vg','4-ビニルグアイアコール','4-Vinylguaiacol','PHENOL','クローブ / 燻製 / 香辛料',['clove','smoked','spice'],'4-vinylguaiacol');
  add('sotolon','ソトロン','Sotolon','FURANONE','カラメル / 熟成の甘さ',['caramel'],'sotolon','清酒標準試薬では「カラメル様」。SDS記載の実成分を表示。');
  add('ethanethiol','エタンチオール','Ethanethiol','SULFUR','ガス / 玉ねぎ',['gas','onion'],'ethanethiol','清酒標準試薬では「メルカプタン」。SDS記載の実成分を表示。');
  add('dms','ジメチルスルフィド','Dimethyl sulfide','SULFUR','青海苔 / コーンスープ / キャベツ',['aonori','corn-soup','cabbage'],'dimethyl sulfide');
  add('dmts','ジメチルトリスルフィド','Dimethyl trisulfide','SULFUR','たくあん / 漬物',['takuan','pickles'],'dimethyl trisulfide','清酒標準試薬では「ポリスルフィド」。SDS記載の実成分を表示。');
  add('tca246','2,4,6-トリクロロアニソール','2,4,6-Trichloroanisole','HALOAROMATIC','カビ / コルク',['mold','cork'],'2,4,6-trichloroanisole');
  add('diacetyl','ジアセチル','Diacetyl','DIKETONE','発酵バター / ヨーグルト',['fermented-butter','yogurt'],'2,3-butanedione');
  add('hexanoic-acid','ヘキサン酸','Hexanoic acid','ACID','油 / 樹脂',['cooking-oil','resin'],'hexanoic acid','清酒標準試薬では「脂肪酸」。SDS記載の実成分を表示。');
  add('acetic-acid','酢酸','Acetic acid','ACID','酢 / 酸臭',['vinegar']);
  add('butyric-acid','酪酸','Butyric acid','ACID','チーズ / 銀杏',['cheese','ginkgo-nut'],'butanoic acid');
  add('isovaleric-acid','イソ吉草酸','Isovaleric acid','ACID','納豆 / 汗',['natto','sweat'],'3-methylbutanoic acid');
  add('linalool','リナロール','Linalool','TERPENE ALCOHOL','ラベンダー / 甘い花',['lavender','sweet-flower']);
  add('beta-damascenone','β-ダマセノン','β-Damascenone','NORISOPRENOID','蜂蜜 / 熟した果実',['honey','apple-red'],'beta-damascenone');
  add('vanillin','バニリン','Vanillin','PHENOLIC ALDEHYDE','バニラ / オーク樽',['vanilla','oak-barrel']);
  add('edmp','2-エチル-3,5-ジメチルピラジン','2-Ethyl-3,5-dimethylpyrazine','PYRAZINE','ナッツ / ロースト',['nuts','smoky-charred'],'2-ethyl-3,5-dimethylpyrazine');
  add('furfural','フルフラール','Furfural','FURAN ALDEHYDE','煙 / 焦げ・トースト',['smoke','smoky-charred']);
  add('ethyl-laurate','ラウリン酸エチル','Ethyl laurate','ESTER','石鹸',['soap'],'ethyl dodecanoate');
  add('octenol','1-オクテン-3-オール','1-Octen-3-ol','ALCOHOL','キノコ / 土',['mushroom','soil'],'1-octen-3-ol');
  add('furaneol','4-ヒドロキシ-2,5-ジメチル-3(2H)-フラノン','Furaneol / HDMF','FURANONE','イチゴキャンディ / カラメル',['strawberry-candy','caramel'],'furaneol');
  add('ibmp','2-イソブチル-3-メトキシピラジン','IBMP','PYRAZINE','ピーマン / 青葉',['green-pepper','young-green-leaves'],'2-isobutyl-3-methoxypyrazine');
  add('3mh','3-メルカプトヘキサノール','3-Mercaptohexan-1-ol / 3MH','SULFUR ALCOHOL','グレープフルーツ',['grapefruit'],'3-mercaptohexan-1-ol');
  add('beta-ionone','β-イオノン','β-Ionone','NORISOPRENOID','スミレ / フローラル',['violet'],'beta-ionone');
  add('tdn','1,1,6-トリメチル-1,2-ジヒドロナフタレン','TDN','AROMATIC','灯油 / ペトロール',['kerosene'],'1,1,6-trimethyl-1,2-dihydronaphthalene');
  add('4vp','4-ビニルフェノール','4-Vinylphenol / 4VP','PHENOL','フェノール / 薬品',['phenol'],'4-vinylphenol');
  add('4eg','4-エチルグアヤコール','4-Ethylguaiacol / 4EG','PHENOL','燻製 / 香辛料',['smoked','spice'],'4-ethylguaiacol');
  add('2ap','2-アセチル-1-ピロリン','2-Acetyl-1-pyrroline','HETEROCYCLE','コーン / 炒った穀物',['corn'],'2-acetyl-1-pyrroline');
  add('so2','二酸化硫黄','Sulfur dioxide','SULFUR OXIDE','マッチ / 亜硫酸',['match-sulfite'],'sulfur dioxide');
  add('eugenol','オイゲノール','Eugenol','PHENOL','クローブ / 香辛料',['clove','spice'],'eugenol');
  add('hexadienol','trans,trans-2,4-ヘキサジエノール','trans,trans-2,4-Hexadien-1-ol','ALCOHOL','青臭い・アルデヒド系 / 草',['green-aldehydic','grass'],'trans,trans-2,4-hexadien-1-ol');
  add('cis3hexenol','cis-3-ヘキセノール','cis-3-Hexen-1-ol','ALCOHOL','草 / 青葉',['grass','young-green-leaves'],'cis-3-hexen-1-ol');
  add('geraniol','ゲラニオール','Geraniol','TERPENE ALCOHOL','バラ / 甘い花',['rose','sweet-flower']);
  add('isobutanol','イソブタノール','Isobutanol','ALCOHOL','酒・アルコール / 溶剤',['alcohol-sake','solvent'],'2-methyl-1-propanol');
  add('h2s','硫化水素','Hydrogen sulfide','SULFUR','腐った卵 / 還元臭',['rotten-egg'],'hydrogen sulfide','ワイン官能評価標準試薬では欠番。既存AROMA LABの学習用リファレンスとして維持。');
  add('4ep','4-エチルフェノール','4-Ethylphenol / 4EP','PHENOL','馬小屋・獣臭 / フェノール',['stable-animal','phenol'],'4-ethylphenol');
  add('athp','2-アセチル-3,4,5,6-テトラヒドロピリジン','ATHP','HETEROCYCLE','ネズミ臭',['mouse'],'2-acetyl-3,4,5,6-tetrahydropyridine');
  add('geosmin','ジオスミン','Geosmin','TERPENOID','土 / 雨上がり',['soil'],'geosmin');
  add('styrene','スチレン','Styrene','AROMATIC','プラスチック / 樹脂',['plastic','resin'],'styrene');
  add('guaiacol','グアヤコール','Guaiacol','PHENOL','煙 / フェノール',['smoke','phenol'],'guaiacol');
  add('tca236','2,3,6-トリクロロアニソール','2,3,6-Trichloroanisole','HALOAROMATIC','カビ / コルク',['mold','cork'],'2,3,6-trichloroanisole');
  add('3mbt','3-メチル-2-ブテン-1-チオール','3-Methyl-2-buten-1-thiol','SULFUR','スカンク / 日光臭',['skunk'],'3-methyl-2-buten-1-thiol');
  add('trans2nonenal','trans-2-ノネナール','trans-2-Nonenal','ALDEHYDE','段ボール・古紙 / 老化臭',['cardboard-old-paper'],'trans-2-nonenal');
  add('citronellol','シトロネロール','Citronellol','TERPENE ALCOHOL','バラ / グレープフルーツ',['rose','grapefruit'],'citronellol');
  add('dcp26','2,6-ジクロロフェノール','2,6-Dichlorophenol','HALOPHENOL','フェノール / 薬品・消毒',['phenol'],'2,6-dichlorophenol');

  ['ethyl-acetate','isoamyl-acetate','ethyl-hexanoate','ethanol','isoamyl-alcohol','phenethyl-alcohol','acetaldehyde','isovaleraldehyde','4vg','sotolon','ethanethiol','dms','dmts','tca246','diacetyl','hexanoic-acid','acetic-acid','butyric-acid','isovaleric-acid'].forEach((id,i)=>app(id,'sake',i+1));
  ['isoamyl-acetate','ethyl-hexanoate','ethyl-acetate','phenethyl-alcohol','linalool','beta-damascenone','vanillin','sotolon','edmp','furfural','4vg','dmts','acetic-acid','diacetyl','acetaldehyde','isovaleraldehyde','isoamyl-alcohol','ethyl-laurate','octenol','tca246'].forEach((id,i)=>app(id,'shochu',i+1));
  ['furaneol','ibmp','linalool','3mh','beta-ionone','beta-damascenone','tdn','isoamyl-acetate','isoamyl-alcohol','diacetyl','ethyl-acetate','4vp','4eg','2ap','so2','tca246','eugenol','sotolon'].forEach((id,i)=>app(id,'wine',i+1,'standard'));
  ['hexadienol','cis3hexenol','geraniol','ethyl-hexanoate','isobutanol','phenethyl-alcohol','h2s','ethanethiol','dms','acetaldehyde','acetic-acid','butyric-acid','isovaleric-acid','4vg','4ep','athp','geosmin','styrene','vanillin','guaiacol'].forEach((id,i)=>app(id,'wine',i+1,'professional'));
  ['tca236','phenethyl-alcohol','3mbt','4vg','acetaldehyde','butyric-acid','diacetyl','dms','ethyl-acetate','ethyl-hexanoate','trans2nonenal','citronellol','geraniol','linalool','dcp26','ethanethiol','isoamyl-alcohol'].forEach((id,i)=>app(id,'beer',i+1));

  window.AROMA_LAB_DATA={ASSET,icons,iconById,groups,drinks,compounds,byId};
})();
