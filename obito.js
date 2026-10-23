/* OBITO: the EC Team Hub assistant.
   No external AI. It reads the app's own content (sections, cards, FAQ, tables) and answers only from that,
   and it runs the app's own calculators for number questions. Floating chat button on every page. */
(function(){
'use strict';
var doc=document;
function $(s,r){return (r||doc).querySelector(s)}
function $$(s,r){return [].slice.call((r||doc).querySelectorAll(s))}
function byId(i){return doc.getElementById(i)}

var SPACES={'v-home':['Home',''],'v-client':['Clients','#client'],'v-client-tools':['Clients toolkit','#client-tools'],
  'v-ib':['IBs & Partners','#ib'],'v-ib-tools':['IBs & Partners toolkit','#ib-tools'],'v-bdm':['BDM Team','#bdm'],'v-bdm-tools':['BDM toolkit','#bdm-tools']};

/* ---------- 1. read the app ---------- */
var SKIP={SELECT:1,BUTTON:1,SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,SVG:1,SYMBOL:1,OPTION:1};
var INLINE={EM:1,B:1,STRONG:1,I:1,SMALL:1,CODE:1,A:1};
var BLOCK={DIV:1,P:1,LI:1,TR:1,H1:1,H2:1,H3:1,H4:1,SUMMARY:1,SECTION:1,UL:1,LABEL:1,DETAILS:1};
function walk(n,out){
  if(n.nodeType===3){out.push(n.nodeValue);return}
  if(n.nodeType!==1||SKIP[n.tagName.toUpperCase()])return;
  var tag=n.tagName.toUpperCase(),blk=BLOCK[tag];
  if(blk)out.push('\n');else if(!INLINE[tag])out.push(' ');
  if(tag==='TD'||tag==='TH'){out.push(' ')}
  for(var c=n.firstChild;c;c=c.nextSibling)walk(c,out);
  if(blk)out.push('\n');else if(!INLINE[tag])out.push(' ');
}
function text(el){
  var o=[];walk(el,o);
  return o.join('').replace(/[ \t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{2,}/g,'\n').trim();
}
function flat(s){return s.replace(/\s+/g,' ').trim()}

var CHUNKS=null;
function build(){
  var chunks=[],seen={};
  function add(view,head,t,el,key,kind,sec){
    t=t.trim();if(flat(t).length<20)return;
    var k=flat(t).toLowerCase();if(seen[k])return;seen[k]=1;
    chunks.push({view:view,head:flat(head||''),text:t,el:el,key:key||'',kind:kind||'',sec:sec||null});
  }
  $$('.view').forEach(function(v){
    var view=v.id,tools=/-tools$/.test(view);
    if(view==='v-home')return;
    if(tools){
      var boxes=$$('.panel,[data-form]',v).filter(function(b){return b.id!=='forms'&&!b.classList.contains('preview')&&!$('.panel,[data-form]',b)});
      boxes.forEach(function(b){var h=$('h2',b);add(view,h?text(h):'',text(b).slice(0,900),b)});
    }else{
      var pre=$('.phero',v);if(pre){var h1=$('h2',pre),ld=$('.lead',pre);add(view,h1?text(h1):'',(h1?text(h1):'')+(ld?'\n'+text(ld):''),pre,'','head');$$('.ticker>div',pre).forEach(function(d){add(view,h1?text(h1):'',text(d),d)})}
      $$('section.s',v).forEach(function(sec){
        var heads=$$('.head',sec);
        function headFor(node){
          var hd=null;heads.forEach(function(h){if(h===node||(h.compareDocumentPosition(node)&4))hd=h});
          if(!hd){var f=$('h2,h3',sec);return f?flat(text(f)):''}
          var e=$('.eyebrow',hd),h2=$('h2',hd);
          return (e?flat(text(e))+': ':'')+(h2?flat(text(h2)):'');
        }
        heads.forEach(function(hd){add(view,headFor(hd),text(hd),hd,'','head',sec)});
        var sel='.card,details,.ct,.tier,.note,.tnode,.quote,div:has(>h3),div:has(>h4)';
        $$(sel,sec).filter(function(x){return !$(sel,x)}).forEach(function(x){
          var hf=headFor(x),q=x.tagName==='DETAILS'&&$('summary',x)?flat(text($('summary',x))):'';
          add(view,hf+(q?' · '+q:''),text(x),x);
        });
        $$('.reg,.award,.steps,.ctiers,.tiers,.contact',sec).forEach(function(g){add(view,headFor(g),text(g),g)});
        $$('table',sec).forEach(function(tb){
          var hs=$$('thead th',tb).map(text);
          var rows=$$('tr',tb);
          if(!hs.length&&rows.length&&$$('th',rows[0]).length){hs=$$('th',rows[0]).map(text)}
          var sub=$$('h2,h3,h4',sec).filter(function(h){return h.compareDocumentPosition(tb)&4});
          var th=sub.length?flat(text(sub[sub.length-1])):'',base=headFor(tb);
          var cap=base+(th&&base.indexOf(th)<0?' · '+th:'');
          rows.forEach(function(r){
            var cells=$$('td',r).map(text);if(!cells.length)return;
            var parts=cells.map(function(c,i){return (hs[i]?hs[i]+': ':'')+flat(c)});
            add(view,cap,parts.join('\n'),r,flat(cells[0]).toUpperCase().replace(/\s+/g,''));
          });
        });
      });
      var fn=$('.footnote',v);if(fn)add(view,'Contact and disclosure',text(fn),fn);
    }
  });
  /* contact panel (all spaces) is already inside the client toolkit */
  CHUNKS=chunks;index(chunks);
}

/* ---------- 2. search ---------- */
var STOP={};'a an the is are was were be been am do does did of to in on for and or but with at by from as it its this that these those i you we they he she me my your our can could should would will shall may might work works working happen happens happened many much what which who whom how when where why if then than so not no yes any some all about into over under up down out off per there here has have had get got use used using please tell give show need want know'.split(' ').forEach(function(w){STOP[w]=1});
var SYN={payout:'credit rebate paid',paid:'credited rebate',salary:'commission',bonus:'commission incentive',kyc:'verification documents identity proof',id:'identity passport',passport:'identity',docs:'documents',
  stopout:'stop out',margincall:'margin call',lev:'leverage',ib:'introducing partner',mib:'master',sib:'sub',rebates:'rebate',licence:'license regulator',license:'licence regulator',regulation:'regulator licence',
  safe:'regulated insurance protection',insurance:'lloyd insolvency',islamic:'swap free',swapfree:'swap free',withdrawal:'withdraw',withdrawals:'withdraw',deposit:'deposit net',email:'subject sends',
  fees:'cost spread commission',fee:'cost spread commission',cost:'spread commission',price:'spread pricing',pricing:'spread',holiday:'leave annual',vacation:'leave annual',late:'grace',hours:'9 6 monday friday',
  dress:'dress code',compliance:'compliance licence category',advice:'advice never',whatsapp:'messaging company channels personal',call:'calls recorded 3cx',phone:'phone support',contact:'support email phone',
  award:'awards recognition',awards:'recognition',country:'countries',office:'offices',employee:'employees',ceo:'chairman',minimum:'minimum requires',min:'minimum',archived:'archiving',archive:'archiving',
  cent:'cent usc',pamm:'pamm money manager investor',copy:'copy trading strategy',mt4:'mt4 platform',mt5:'mt5 platform',app:'app platform',crypto:'crypto bitcoin',oil:'crude energy',gold:'metal xau',stocks:'stock shares',
  sub:'sub ib',countries:'country nationality',country:'nationality',nationalities:'nationality',sim:'security 3cx report',stop:'risk margin call mauritius',documents:'document identity proof address kyc',lose:'lost report',loss:'lost',parent:'parent ib',tier:'tier commission',leverage:'leverage',spread:'spread',differential:'differential',rebate:'rebate'};
function stem(w){
  if(w.length>5&&/ies$/.test(w))return w.slice(0,-3)+'y';
  if(w.length>5&&/(ing|ed)$/.test(w))return w.replace(/(ing|ed)$/,'');
  if(w.length>4&&/es$/.test(w)&&!/ses$/.test(w))return w.slice(0,-2);
  if(w.length>3&&/s$/.test(w)&&!/ss$/.test(w))return w.slice(0,-1);
  return w;
}
function toks(s,keepStop){
  var raw=s.toLowerCase().replace(/[’']/g,'').match(/\d+:\d+|[a-z]+(?:-[a-z]+)*|\d+(?:\.\d+)?/g)||[],out=[];
  raw.forEach(function(w){
    if(/-/.test(w)){out.push(stem(w.replace(/-/g,'')));w.split('-').forEach(function(p){if(p&&!STOP[p])out.push(stem(p))});return}
    if(/:/.test(w)){out.push(w);out.push(w.split(':')[1]);return}
    if(!keepStop&&STOP[w])return;
    out.push(stem(w));
  });
  return out;
}
(function(){var o={};Object.keys(SYN).forEach(function(k){var sk=stem(k);o[sk]=o[sk]?o[sk]+' '+SYN[k]:SYN[k]});SYN=o})();
var IDX=null;
function index(chunks){
  var df={},tot=0;
  chunks.forEach(function(c){
    var h=toks(c.head),t=toks(c.text),all=h.concat(h,t);
    c.low=flat(c.text).toLowerCase();c.first=flat(c.text.split('\n')[0]).toLowerCase();
    c.tf={};all.forEach(function(w){c.tf[w]=(c.tf[w]||0)+1});c.len=all.length;tot+=all.length;
    Object.keys(c.tf).forEach(function(w){df[w]=(df[w]||0)+1});
  });
  IDX={df:df,N:chunks.length,avg:tot/Math.max(1,chunks.length)};
}
function search(q,limit){
  if(!CHUNKS)build();
  var base=toks(q),terms={};
  base.forEach(function(w){terms[w]=Math.max(terms[w]||0,1)});
  (q.match(/[A-Z]{2,6}/g)||[]).forEach(function(c){toks(c).forEach(function(w){terms[w]=2})});
  base.forEach(function(w){var s=SYN[w];if(s)toks(s).forEach(function(x){terms[x]=Math.max(terms[x]||0,.5)})});
  var rw=(q.toLowerCase().match(/[a-z0-9]+/g)||[]),phrases=[];
  [3,2,1].forEach(function(n){for(var i=0;i+n<=rw.length;i++){var w=rw.slice(i,i+n);if(STOP[w[0]]||STOP[w[n-1]])continue;if(n===1&&w[0].length<3)continue;phrases.push(w.join(' '))}});
  var k1=1.4,b=.45,res=[];
  CHUNKS.forEach(function(c){
    var s=0,hit=0;
    Object.keys(terms).forEach(function(w){
      var f=c.tf[w];if(!f)return;hit++;
      var n=IDX.df[w],idf=Math.log(1+(IDX.N-n+.5)/(n+.5));
      s+=terms[w]*idf*(f*(k1+1))/(f+k1*(1-b+b*c.len/IDX.avg));
    });
    var cover=hit/Math.max(1,Object.keys(terms).length);
    if(s>0){
      var bonus=0;
      phrases.forEach(function(p){
        var n=p.split(' ').length;
        if(n>1&&c.low.indexOf(p)>-1)bonus+=2*n;
        if(c.first===p||c.first.indexOf(p+' ')===0)bonus+=3;
      });
      var pen=(c.kind==='head'?.7:1)*(/-tools$/.test(c.view)?.6:1);
      res.push({c:c,s:(s+Math.min(bonus,8))*(.6+.4*cover)*pen});
    }
  });
  res.sort(function(a,b){return b.s-a.s});
  return res.slice(0,limit||3);
}

/* ---------- 3. tools: drive the app's own calculators ---------- */
function fire(el,type){el.dispatchEvent(new Event(type,{bubbles:true}))}
function setv(id,v,ev){var e=byId(id);if(!e)return;e.value=v;fire(e,ev||'input')}
function snapshot(ids){var o={};ids.forEach(function(i){var e=byId(i);if(e)o[i]=e.value});return o}
function restore(o,changeIds){Object.keys(o).forEach(function(i){setv(i,o[i],changeIds&&changeIds.indexOf(i)>-1?'change':'input')})}
function money(n,d){return (n<0?'-$':'$')+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})}
function nums(q){
  var out=[],re=/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|%|lots?)?/gi,m;
  while((m=re.exec(q))){
    var unit=(m[2]||'').toLowerCase();if(unit==='%'||/^lot/.test(unit))continue;
    var after=q.slice(re.lastIndex,re.lastIndex+2);if(/^:\d/.test(after))continue;
    var v=parseFloat(m[1].replace(/,/g,''));if(unit==='k')v*=1e3;if(unit==='m')v*=1e6;out.push(v);
  }
  return out;
}
function pcts(q){var o=[],re=/(\d+(?:\.\d+)?)\s*%/g,m;while((m=re.exec(q)))o.push(parseFloat(m[1]));return o}
function lotsOf(q){var m=/(\d*\.?\d+)\s*(?:standard\s+)?lots?\b/i.exec(q);return m?parseFloat(m[1]):null}

function toolGroup(q){
  var m=/\b((?:std|ecn)(?:-[a-z]+)+)\b/i.exec(q);if(!m||!byId('gc-in'))return null;
  var code=m[1].toUpperCase(),keep=byId('gc-in').value;
  setv('gc-in',code);var dec=byId('gc-out').textContent;setv('gc-in',keep);
  if(!CHUNKS)build();
  var key=code.replace(/-/g,''),rows=CHUNKS.filter(function(c){return c.key&&c.key.replace(/-/g,'')===key}).slice(0,3);
  var lines=[dec];
  rows.forEach(function(r){lines.push('\n'+r.head+'\n'+r.text)});
  return {title:'Group '+code,lines:lines,source:'Group code decoder and partner tables',go:{hash:'#ib-tools',el:byId('gc-in')},rows:rows};
}
function tiers(){
  return $$('#c-tiers .ct').map(function(r){
    var lab=text($('span',r)),rate=parseFloat(text($('b',r))),n=/(\d[\d,]*)/.exec(lab);
    return {lo:/^less/i.test(lab)||!n?0:parseFloat(n[1].replace(/,/g,'')),rate:rate};
  });
}
function toolCommission(q){
  if(!/commission|net deposit|\btier\b|my rate/i.test(q)||/rebate|margin|pamm|\blots?\b|\bib\b/i.test(q))return null;
  var T=tiers(),a=nums(q);if(!T.length||!a.length)return null;
  var avg,note;
  if(a.length>=3){avg=(a[0]+a[1]+a[2])/3;note='Average of '+money(a[0])+', '+money(a[1])+' and '+money(a[2])+'.'}
  else if(a.length===1){avg=a[0];note='Treating '+money(a[0])+' as your 3-month average net deposit. Give three months to get the exact average.'}
  else return {title:'Commission',lines:['I need either one average or all three monthly net deposits. Example: "commission for 60000, 80000, 20000".'],source:'Commission Tier Policy 2026'};
  var k=0;T.forEach(function(t,i){if(avg>=t.lo)k=i});
  var lines=[note,'3-month average: '+money(avg),'Your rate: '+T[k].rate.toFixed(1)+'%','Commission: '+money(avg*T[k].rate/100)];
  if(k<T.length-1)lines.push('To reach '+T[k+1].rate.toFixed(1)+'% the average needs '+money(T[k+1].lo-avg)+' more.');else lines.push('This is the top tier.');
  return {title:'Commission estimate',lines:lines,source:'Commission Tier Policy 2026 (BDM toolkit)',go:{hash:'#bdm-tools',tab:'comm',el:byId('c-tiers')}};
}
function toolLevel(q){
  if(!/\blevel\b|platinum|diamond|upgrade|which ib/i.test(q)||!byId('lv-targets'))return null;
  var lots=lotsOf(q),a=nums(q).filter(function(n){return n!==lots});
  if(lots===null&&!a.length)return null;
  var dep=a.length?a[0]:0;lots=lots||0;
  var T=$$('#lv-targets tbody tr').map(function(r){var c=$$('td',r).map(text);return {name:c[0],dep:parseFloat(c[1].replace(/[^\d.]/g,'')),lots:parseFloat(c[2].replace(/[^\d.]/g,''))}});
  var k=-1;T.forEach(function(t,i){if(dep>=t.dep||lots>=t.lots)k=i});
  var lines=['Deposit volume '+money(dep)+' and '+lots.toLocaleString('en-US')+' lots over 3 months.','Level: '+(k<0?'Below General':T[k].name)];
  if(k+1<T.length){var n=T[k+1];lines.push('Next level: '+n.name+'. Needs '+money(Math.max(0,n.dep-dep))+' more deposit volume or '+Math.max(0,n.lots-lots).toLocaleString('en-US')+' more lots (either one).')}else lines.push('This is the top level.');
  return {title:'IB level',lines:lines,source:'IB cooperation terms 2026',go:{hash:'#ib-tools',el:byId('lc-dep')}};
}
function toolPamm(q){
  if(!/pamm|money manager|profit shar/i.test(q)||!byId('pm-amt'))return null;
  var p=pcts(q),a=nums(q);if(!a.length||!p.length)return null;
  var keep=snapshot(['pm-amt','pm-ret','pm-share']);
  setv('pm-amt',a[0]);setv('pm-ret',p[0]);if(p.length>1)setv('pm-share',p[1]);
  var r=['pm-gross','pm-fee','pm-net','pm-end','pm-netpct'].map(function(i){return text(byId(i))});
  var share=byId('pm-share').value;restore(keep);
  return {title:'PAMM split',lines:['Investment '+money(a[0])+', cycle result '+p[0]+'%, manager share '+share+'%'+(p.length>1?'':' (default in the calculator)')+'.','Gross result: '+r[0],"Manager's share: "+r[1],'Investor result: '+r[2],'Investment after cycle: '+r[3]+' ('+r[4]+')','The manager share applies to profit only.'],source:"The app's PAMM calculator",go:{hash:'#client-tools',el:byId('pm-amt')}};
}
function symbols(){
  return $$('#tc-sym option').map(function(o){
    var v=o.value,t=o.textContent.toLowerCase(),al=[v.toLowerCase(),t.replace(/\(.*\)/,'').replace(/[\/\s]/g,'')],pm=/\(([^)]+)\)/.exec(t);
    if(pm)al.push(pm[1].toLowerCase());al.push(v.slice(0,3).toLowerCase());
    if(v==='USOIL')al.push('oil','wti','crude');if(v==='XAUUSD')al.push('gold','xau');
    return {v:v,al:al.filter(function(a){return a.length>=3})};
  });
}
function toolTrade(q){
  if(!byId('tc-sym')||!/margin|pip value|pip\b|profit|loss|p\/l|pnl|how much.*(lot|trade)/i.test(q))return null;
  var low=q.toLowerCase().replace(/[\/\s]/g,'')+' '+q.toLowerCase(),sym=null;
  symbols().some(function(s){return s.al.some(function(a){if(new RegExp('(^|[^a-z])'+a+'([^a-z]|$)').test(low)||low.indexOf(a)>-1&&a.length>=6){sym=s;return true}})});
  if(!sym)return null;
  var lots=lotsOf(q)||1,lv=/1\s*:\s*(\d+)/.exec(q)||/leverage\s*(?:of)?\s*(\d+)/i.exec(q),ft=/from\s*(\d*\.?\d+)\s*to\s*(\d*\.?\d+)/i.exec(q),at=/(?:at|@)\s*(\d*\.?\d+)/i.exec(q.replace(/1\s*:\s*\d+/g,' '));
  var dir=/\bsell|short\b/i.test(q)?'-1':'1';
  var ids=['tc-sym','tc-lots','tc-lev','tc-open','tc-close','tc-dir'],keep=snapshot(ids);
  setv('tc-sym',sym.v,'change');setv('tc-lots',lots);setv('tc-dir',dir,'change');
  var levNote='';
  if(lv){var opt=$$('#tc-lev option').filter(function(o){return o.value===lv[1]||o.textContent===lv[1]})[0];if(opt)setv('tc-lev',opt.value,'change');else levNote='Leverage 1:'+lv[1]+' is not an option in the calculator, so it used 1:'+byId('tc-lev').value+'. '}
  if(ft){setv('tc-open',ft[1]);setv('tc-close',ft[2])}else if(at){setv('tc-open',at[1])}
  var o={pip:text(byId('tc-pip')),lbl:text(byId('tc-piplbl')),margin:text(byId('tc-margin')),pl:text(byId('tc-pl')),lev:byId('tc-levused')?text(byId('tc-levused')):'',open:byId('tc-open').value};
  restore(keep,['tc-sym','tc-lev','tc-dir']);
  var name=$$('#tc-sym option').filter(function(x){return x.value===sym.v})[0].textContent;
  var lines=[lots+' lot'+(lots===1?'':'s')+' of '+name+(dir==='-1'?' (sell)':' (buy)')+', open price '+o.open+(ft||at?'':' (example price in the app)')+'.','Required margin: '+o.margin,o.lbl+': '+o.pip];
  if(ft)lines.push('Profit / loss: '+o.pl);
  if(o.lev)lines.push(o.lev);
  if(levNote)lines.push(levNote.trim());
  lines.push('Estimates in USD before spreads, commission and swaps.');
  return {title:'Trade maths',lines:lines,source:"The app's trading calculator",go:{hash:'#client-tools',el:byId('tc-sym')}};
}

/* ---------- 4. answer ---------- */
var ADVICE=/should i (buy|sell|invest|trade)|will (i|it|the price|they) (make|win|profit|go up|go down|rise|fall)|guarantee|predict|best (pair|coin|stock|trade|strategy)|which (pair|coin|stock|asset)[^.?]*\b(buy|trade|invest)|get rich|sure profit/i;
function chunkAnswer(r,idx){
  var c=r.c,t=c.kind==='head'&&c.sec&&c.sec.nodeType===1?text(c.sec):c.text;if(t.length>800)t=t.slice(0,780).replace(/\s+\S*$/,'')+'…';
  return {title:(SPACES[c.view]||['',''])[0]+(c.head?' · '+c.head:''),lines:[t],source:null,go:{hash:(SPACES[c.view]||['',''])[1],el:c.el}};
}
function ask(q){
  q=q.trim();var low=q.toLowerCase();
  if(!q)return null;
  if(/[؀-ۿऀ-ॿ一-鿿]/.test(q)&&!/[a-z]{3}/i.test(q))return {title:'Language',lines:['I read English questions best. Please ask in English, or use the Client messages tool for Arabic, Hindi and Chinese client texts.']};
  if(/^(hi|hello|hey|hola|salam|good (morning|evening|afternoon)|yo)\b[\s!.]*$/.test(low))return {title:'OBITO',lines:['Hi. Ask me about accounts, IB rebates and levels, commission, rules, KYC, PAMM or any number in the app.']};
  if(/^(thanks|thank you|thx|ok|okay|great|cool)[\s!.]*$/.test(low))return {title:'OBITO',lines:['Any time. Ask me the next one.']};
  if(/who (are|made|built|created) you|what are you|what can you do|help\b/.test(low)&&low.length<60)
    return {title:'About OBITO',lines:['I am OBITO, the assistant of the EC Team Hub.','I am not an AI model that guesses. I search the content inside this app and answer only from it, and I run the app\'s own calculators for numbers.','Try: commission for 60000, 80000, 20000 · decode STD-PXX · margin for 1 lot BTCUSD · who sends a group change request · documents accepted as proof of address.','If I do not find it, I say so.']};
  var tools=[toolGroup,toolCommission,toolLevel,toolPamm,toolTrade];
  for(var i=0;i<tools.length;i++){var r;try{r=tools[i](q)}catch(e){r=null}if(r)return r}
  var res=search(q,4);
  if(ADVICE.test(q)){
    var g=search('never promise returns advice compliance category 5 escalate',2).map(chunkAnswer);
    return {title:'Advice and predictions',lines:['I cannot give investment advice or predict results, and neither can we in client conversations.'].concat(g.map(function(x){return x.lines[0]})),source:'BDM compliance rules',go:g[0]&&g[0].go};
  }
  if(!res.length||res[0].s<2.2)return {title:'Not in the app',lines:['I could not find that in the app data, so I will not guess.','Try other words, or ask your manager. For client communication, advice or AML questions ask Compliance. For HR questions ask Human Resources. Client support: support@ecmarkets.com.'],miss:true};
  var top=chunkAnswer(res[0]);
  top.more=res.slice(1).filter(function(x){return x.s>=res[0].s*.6}).slice(0,2).map(chunkAnswer);
  return top;
}

/* ---------- 5. interface ---------- */
var css='#obito-fab{position:fixed;right:20px;bottom:20px;z-index:80;display:flex;align-items:center;gap:10px;padding:10px 16px 10px 10px;border-radius:99px;border:1px solid rgba(229,57,47,.6);background:var(--panel,#211D21);color:var(--fg,#F5F0F0);font:600 14px var(--body,system-ui);cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.5);transition:transform .2s,bottom .2s}'+
'#obito-fab[hidden]{display:none}#obito-fab:hover{transform:translateY(-2px)}#obito-fab:focus-visible,#obito-panel button:focus-visible,#obito-in:focus-visible{outline:2px solid var(--red,#E5392F);outline-offset:2px}'+
'.ob-mark{width:34px;height:34px;border-radius:50%;background:var(--red,#E5392F);color:#fff;display:grid;place-items:center;font:800 13px var(--body,system-ui);letter-spacing:.02em;flex:none}'+
'#obito-fab.lift{bottom:96px}'+
'#obito-panel{position:fixed;right:20px;bottom:20px;z-index:85;width:min(420px,calc(100vw - 24px));height:min(640px,calc(100vh - 40px));display:flex;flex-direction:column;background:var(--band,#191619);border:1px solid var(--line,#3A3338);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.65);overflow:hidden}'+
'#obito-panel[hidden]{display:none}'+
'.ob-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line,#3A3338);background:var(--panel,#211D21)}'+
'.ob-head b{font-size:16px;display:block;line-height:1.1}.ob-head small{display:block;font-size:11px;color:var(--muted,#B5AAAD)}.ob-head .sp{flex:1}'+
'.ob-ib{all:unset;cursor:pointer;color:var(--muted,#B5AAAD);font-size:12px;font-weight:600;padding:6px 10px;border-radius:99px;border:1px solid var(--line,#3A3338)}.ob-ib:hover{color:var(--fg,#F5F0F0);border-color:var(--red,#E5392F)}'+
'#obito-log{flex:1;overflow-y:auto;padding:14px;display:grid;gap:12px;align-content:start;scroll-behavior:smooth}'+
'.ob-m{max-width:92%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.5;color:var(--fg,#F5F0F0);overflow-wrap:anywhere}'+
'.ob-u{justify-self:end;background:var(--red,#E5392F);color:#fff;border-bottom-right-radius:4px}'+
'.ob-b{justify-self:start;background:var(--panel,#211D21);border:1px solid var(--line,#3A3338);border-bottom-left-radius:4px;max-width:100%;width:100%}'+
'.ob-t{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--red,#E5392F);font-weight:600;margin-bottom:6px}'+
'.ob-l{white-space:pre-line}.ob-l+.ob-l{margin-top:6px}'+
'.ob-src{font-size:11.5px;color:var(--muted,#B5AAAD);margin-top:8px}'+
'.ob-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}'+
'.ob-a{all:unset;cursor:pointer;font-size:12px;font-weight:600;padding:6px 11px;border-radius:99px;border:1px solid var(--line,#3A3338);color:var(--fg,#F5F0F0)}.ob-a:hover{border-color:var(--red,#E5392F)}'+
'.ob-more{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line,#3A3338);font-size:13px;color:var(--muted,#B5AAAD)}.ob-more b{color:var(--fg,#F5F0F0)}'+
'.ob-sug{display:flex;gap:6px;flex-wrap:wrap}.ob-sug .ob-a{background:var(--panel,#211D21);text-align:left;font-weight:500}'+
'.ob-form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line,#3A3338);background:var(--panel,#211D21)}'+
'#obito-in{flex:1;min-width:0;background:var(--field,#161316);border:1px solid var(--line,#3A3338);color:var(--fg,#F5F0F0);border-radius:99px;padding:11px 16px;font:500 14px var(--body,system-ui)}'+
'.ob-send{all:unset;cursor:pointer;background:var(--red,#E5392F);color:#fff;font-weight:700;font-size:14px;padding:0 18px;border-radius:99px;display:grid;place-items:center}'+
'.ob-foot{font-size:11px;color:var(--muted,#B5AAAD);padding:0 14px 10px;background:var(--panel,#211D21);line-height:1.4}'+
'@keyframes obflash{0%,100%{box-shadow:none}30%{box-shadow:0 0 0 3px var(--red,#E5392F)}}.ob-flash{animation:obflash 1.6s ease 1;border-radius:12px}'+
'@media (max-width:899px){#obito-fab{bottom:calc(86px + env(safe-area-inset-bottom,0px));right:14px}#obito-fab.lift{bottom:calc(168px + env(safe-area-inset-bottom,0px))}#obito-panel{right:0;left:0;bottom:0;width:100%;height:min(86vh,720px);border-radius:20px 20px 0 0}}'+
'@media (prefers-reduced-motion:reduce){#obito-fab{transition:none}.ob-flash{animation:none}#obito-log{scroll-behavior:auto}}';

var SUGGEST=['Commission for 60000, 80000, 20000','Decode STD-PXX','Margin for 1 lot BTCUSD at 1:200','Who sends a group change request?','Which proof of address is accepted?','What is the leverage on crude oil?','How do IB rebates work?','What can I never say to a client?'];
var panel,log,input,fab,lastFocus;

function el(tag,cls,t){var e=doc.createElement(tag);if(cls)e.className=cls;if(t!=null)e.textContent=t;return e}
function goTo(go){
  if(!go)return;
  close();
  var h=go.hash||'';
  if(h&&location.hash!==h)location.hash=h;
  setTimeout(function(){
    if(go.tab&&window.hubSetTab)window.hubSetTab(go.tab);
    var t=go.el;if(t&&t.scrollIntoView){t.scrollIntoView({behavior:'smooth',block:'center'});t.classList.remove('ob-flash');void t.offsetWidth;t.classList.add('ob-flash')}
  },220);
}
function copyText(t){
  if(window.hubCopy)return window.hubCopy(t);
  try{navigator.clipboard.writeText(t)}catch(e){}
}
function renderBot(a){
  var m=el('div','ob-m ob-b');
  if(a.title)m.appendChild(el('div','ob-t',a.title));
  a.lines.forEach(function(l){m.appendChild(el('div','ob-l',l))});
  if(a.source)m.appendChild(el('div','ob-src','Source: '+a.source));
  if(a.more&&a.more.length){
    var mo=el('div','ob-more');mo.appendChild(el('b',null,'Also in the app'));
    a.more.forEach(function(x){var d=el('div','ob-l',x.title+': '+flat(x.lines[0]).slice(0,170)+(flat(x.lines[0]).length>170?'…':''));d.style.marginTop='6px';var b=el('button','ob-a','Open');b.type='button';b.style.marginLeft='6px';b.onclick=function(){goTo(x.go)};d.appendChild(b);mo.appendChild(d)});
    m.appendChild(mo);
  }
  var act=el('div','ob-act');
  if(a.go){var o=el('button','ob-a','Open in the app');o.type='button';o.onclick=function(){goTo(a.go)};act.appendChild(o)}
  if(!a.miss){var c=el('button','ob-a','Copy answer');c.type='button';c.onclick=function(){copyText((a.title?a.title+'\n':'')+a.lines.join('\n'));c.textContent='Copied';setTimeout(function(){c.textContent='Copy answer'},1400)};act.appendChild(c)}
  if(act.children.length)m.appendChild(act);
  return m;
}
function say(q){
  if(!q.trim())return;
  log.appendChild(el('div','ob-m ob-u',q));
  var a=ask(q);
  log.appendChild(renderBot(a||{lines:['Type a question.']}));
  log.scrollTop=log.scrollHeight;
}
function greet(){
  var m=el('div','ob-m ob-b');
  m.appendChild(el('div','ob-t','OBITO'));
  m.appendChild(el('div','ob-l','Hi, I am OBITO. Ask me about accounts, IB rebates and levels, commission, rules, KYC, PAMM or any number in the app. I answer only from the data inside this app.'));
  var s=el('div','ob-sug');s.style.marginTop='10px';
  SUGGEST.slice(0,6).forEach(function(q){var b=el('button','ob-a',q);b.type='button';b.onclick=function(){say(q)};s.appendChild(b)});
  m.appendChild(s);log.appendChild(m);
}
function open(){
  panel.hidden=false;fab.hidden=true;lastFocus=doc.activeElement;
  if(!CHUNKS)build();
  setTimeout(function(){input.focus()},50);
}
function close(){panel.hidden=true;fab.hidden=false;try{fab.focus({preventScroll:true})}catch(e){}}
function mount(){
  var st=el('style');st.textContent=css;doc.head.appendChild(st);
  fab=el('button');fab.id='obito-fab';fab.type='button';fab.setAttribute('aria-label','Ask OBITO');
  fab.innerHTML='<span class="ob-mark">OB</span><span>Ask OBITO</span>';
  panel=el('section');panel.id='obito-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','OBITO assistant');
  var head=el('div','ob-head');head.innerHTML='<span class="ob-mark">OB</span><span><b>OBITO</b><small>Answers from the data in this app</small></span><span class="sp"></span>';
  var clr=el('button','ob-ib','Clear');clr.type='button';clr.onclick=function(){log.innerHTML='';greet()};
  var x=el('button','ob-ib','Close');x.type='button';x.setAttribute('aria-label','Close OBITO');x.onclick=close;
  head.appendChild(clr);head.appendChild(x);
  log=el('div');log.id='obito-log';log.setAttribute('aria-live','polite');
  var form=el('form','ob-form');input=el('input');input.id='obito-in';input.type='text';input.placeholder='Ask OBITO…';input.autocomplete='off';input.setAttribute('aria-label','Ask OBITO a question');
  var send=el('button','ob-send','Ask');send.type='submit';
  form.appendChild(input);form.appendChild(send);
  form.onsubmit=function(e){e.preventDefault();var q=input.value;input.value='';say(q)};
  var foot=el('div','ob-foot','OBITO searches this app only and can miss things. It is not investment advice. Check with your manager or Compliance when unsure.');
  panel.appendChild(head);panel.appendChild(log);panel.appendChild(form);panel.appendChild(foot);
  doc.body.appendChild(fab);doc.body.appendChild(panel);
  fab.onclick=open;
  doc.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)close()});
  var ib=byId('ibar');
  if(ib){var sync=function(){fab.classList.toggle('lift',!ib.hidden)};sync();new MutationObserver(sync).observe(ib,{attributes:true,attributeFilter:['hidden']})}
  greet();
}
window.OBITO={ask:ask,search:search,rebuild:function(){CHUNKS=null;build();return CHUNKS.length},size:function(){if(!CHUNKS)build();return CHUNKS.length}};
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
})();
