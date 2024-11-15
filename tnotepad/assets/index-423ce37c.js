(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))l(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&l(r)}).observe(document,{childList:!0,subtree:!0});function n(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function l(s){if(s.ep)return;s.ep=!0;const o=n(s);fetch(s.href,o)}})();function q(){}function mt(t){return t()}function $e(){return Object.create(null)}function Y(t){t.forEach(mt)}function ce(t){return typeof t=="function"}function se(t,e){return t!=t?e==e:t!==e||t&&typeof t=="object"||typeof t=="function"}function Jt(t){return Object.keys(t).length===0}function gt(t,...e){if(t==null)return q;const n=t.subscribe(...e);return n.unsubscribe?()=>n.unsubscribe():n}function X(t){let e;return gt(t,n=>e=n)(),e}function he(t,e,n){t.$$.on_destroy.push(gt(e,n))}function g(t,e){t.appendChild(e)}function R(t,e,n){t.insertBefore(e,n||null)}function U(t){t.parentNode&&t.parentNode.removeChild(t)}function bt(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e)}function v(t){return document.createElement(t)}function $(t){return document.createTextNode(t)}function T(){return $(" ")}function Me(){return $("")}function O(t,e,n,l){return t.addEventListener(e,n,l),()=>t.removeEventListener(e,n,l)}function Ke(t){return function(e){return e.stopPropagation(),t.call(this,e)}}function b(t,e,n){n==null?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function jt(t){return Array.from(t.childNodes)}function Le(t,e){e=""+e,t.data!==e&&(t.data=e)}function xe(t,e){t.value=e??""}function Bt(t,e,n,l){n==null?t.style.removeProperty(e):t.style.setProperty(e,n,l?"important":"")}function L(t,e,n){t.classList[n?"add":"remove"](e)}function Gt(t,e,{bubbles:n=!1,cancelable:l=!1}={}){const s=document.createEvent("CustomEvent");return s.initCustomEvent(t,n,l,e),s}let Ee;function Ce(t){Ee=t}function Be(){if(!Ee)throw new Error("Function called outside component initialization");return Ee}function ye(t){Be().$$.on_mount.push(t)}function Vt(t){Be().$$.on_destroy.push(t)}function Wt(){const t=Be();return(e,n,{cancelable:l=!1}={})=>{const s=t.$$.callbacks[e];if(s){const o=Gt(e,n,{cancelable:l});return s.slice().forEach(r=>{r.call(t,o)}),!o.defaultPrevented}return!0}}const me=[],le=[];let ge=[];const et=[],vt=Promise.resolve();let He=!1;function wt(){He||(He=!0,vt.then(kt))}function Oe(){return wt(),vt}function ze(t){ge.push(t)}const Pe=new Set;let pe=0;function kt(){if(pe!==0)return;const t=Ee;do{try{for(;pe<me.length;){const e=me[pe];pe++,Ce(e),Xt(e.$$)}}catch(e){throw me.length=0,pe=0,e}for(Ce(null),me.length=0,pe=0;le.length;)le.pop()();for(let e=0;e<ge.length;e+=1){const n=ge[e];Pe.has(n)||(Pe.add(n),n())}ge.length=0}while(me.length);for(;et.length;)et.pop()();He=!1,Pe.clear(),Ce(t)}function Xt(t){if(t.fragment!==null){t.update(),Y(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(ze)}}function qt(t){const e=[],n=[];ge.forEach(l=>t.indexOf(l)===-1?e.push(l):n.push(l)),n.forEach(l=>l()),ge=e}const Ae=new Set;let ie;function Se(){ie={r:0,c:[],p:ie}}function Ie(){ie.r||Y(ie.c),ie=ie.p}function K(t,e){t&&t.i&&(Ae.delete(t),t.i(e))}function J(t,e,n,l){if(t&&t.o){if(Ae.has(t))return;Ae.add(t),ie.c.push(()=>{Ae.delete(t),l&&(n&&t.d(1),l())}),t.o(e)}else l&&l()}function Je(t,e){J(t,1,1,()=>{e.delete(t.key)})}function je(t,e,n,l,s,o,r,c,p,i,u,d){let a=t.length,h=o.length,_=a;const y={};for(;_--;)y[t[_].key]=_;const C=[],m=new Map,k=new Map,D=[];for(_=h;_--;){const I=d(s,o,_),H=n(I);let F=r.get(H);F?l&&D.push(()=>F.p(I,e)):(F=i(H,I),F.c()),m.set(H,C[_]=F),H in y&&k.set(H,Math.abs(_-y[H]))}const w=new Set,N=new Set;function A(I){K(I,1),I.m(c,u),r.set(I.key,I),u=I.first,h--}for(;a&&h;){const I=C[h-1],H=t[a-1],F=I.key,V=H.key;I===H?(u=I.first,a--,h--):m.has(V)?!r.has(F)||w.has(F)?A(I):N.has(V)?a--:k.get(F)>k.get(V)?(N.add(F),A(I)):(w.add(V),a--):(p(H,r),a--)}for(;a--;){const I=t[a];m.has(I.key)||p(I,r)}for(;h;)A(C[h-1]);return Y(D),C}function te(t){t&&t.c()}function x(t,e,n,l){const{fragment:s,after_update:o}=t.$$;s&&s.m(e,n),l||ze(()=>{const r=t.$$.on_mount.map(mt).filter(ce);t.$$.on_destroy?t.$$.on_destroy.push(...r):Y(r),t.$$.on_mount=[]}),o.forEach(ze)}function ee(t,e){const n=t.$$;n.fragment!==null&&(qt(n.after_update),Y(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function Yt(t,e){t.$$.dirty[0]===-1&&(me.push(t),wt(),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function ue(t,e,n,l,s,o,r,c=[-1]){const p=Ee;Ce(t);const i=t.$$={fragment:null,ctx:[],props:o,update:q,not_equal:s,bound:$e(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(e.context||(p?p.$$.context:[])),callbacks:$e(),dirty:c,skip_bound:!1,root:e.target||p.$$.root};r&&r(i.root);let u=!1;if(i.ctx=n?n(t,e.props||{},(d,a,...h)=>{const _=h.length?h[0]:a;return i.ctx&&s(i.ctx[d],i.ctx[d]=_)&&(!i.skip_bound&&i.bound[d]&&i.bound[d](_),u&&Yt(t,d)),a}):[],i.update(),u=!0,Y(i.before_update),i.fragment=l?l(i.ctx):!1,e.target){if(e.hydrate){const d=jt(e.target);i.fragment&&i.fragment.l(d),d.forEach(U)}else i.fragment&&i.fragment.c();e.intro&&K(t.$$.fragment),x(t,e.target,e.anchor,e.customElement),kt()}Ce(p)}class fe{$destroy(){ee(this,1),this.$destroy=q}$on(e,n){if(!ce(n))return q;const l=this.$$.callbacks[e]||(this.$$.callbacks[e]=[]);return l.push(n),()=>{const s=l.indexOf(n);s!==-1&&l.splice(s,1)}}$set(e){this.$$set&&!Jt(e)&&(this.$$.skip_bound=!0,this.$$set(e),this.$$.skip_bound=!1)}}const _e=[];function ae(t,e=q){let n;const l=new Set;function s(c){if(se(t,c)&&(t=c,n)){const p=!_e.length;for(const i of l)i[1](),_e.push(i,t);if(p){for(let i=0;i<_e.length;i+=2)_e[i][0](_e[i+1]);_e.length=0}}}function o(c){s(c(t))}function r(c,p=q){const i=[c,p];return l.add(i),l.size===1&&(n=e(s)||q),c(t),()=>{l.delete(i),l.size===0&&n&&(n(),n=null)}}return{set:s,update:o,subscribe:r}}class M{constructor(e,n="",l=[]){this.id=e,this.markup=ae(n),this.children=ae(l)}add(e){X(this.children).includes(e.id)||this.children.set([...X(this.children),e.id])}}const tt=2,Qt={0:new M(0,"0",[29]),18:new M(18,"For example, these two grandchildren are copied using Ctrl+C. Changing the text or children of one affects both.",[19,24]),19:new M(19,"Keep me expanded.",[23]),23:new M(23,"Try changing me!",[]),24:new M(24,"Keep me expanded.",[23]),25:new M(25,"Advanced",[26,40,28]),26:new M(26,"Shift+Tab to expand by 3 levels",[]),27:new M(27,'"Enter" to make a note editable. "Alt" to return it to normal.',[]),28:new M(28,`Ctrl+b to embed copied notes into an editable textbox.
<a id="26" href="#0">It looks like this and can be clicked on</a>`,[]),29:new M(29,`Instructions
`,[30,35,34,31,41,27,32,25]),30:new M(30,`This is a notepad app. 
`,[]),31:new M(31,'Press "Insert" key to add a new note as the child of the focused note.',[33]),32:new M(32,`Copy selected notes by reference with Ctrl+C. 
Copy them in "cut" mode with Ctrl+X.
Paste them with Ctrl+V. If in cut mode, removes the original.
`,[18]),33:new M(33,'"Ctrl" + "Insert" holds the focus in place.',[39]),34:new M(34,"Use the Up and Down arrows to move focus around.You can also use the mouse.",[37,38]),35:new M(35,'Press "Tab" to expand or collapse the focused note',[36]),36:new M(36,"If a note has a thick toggle arrow, then it has children",[]),37:new M(37,"Holding shift will let you reposition siblings",[]),38:new M(38,'Try focusing me and pressing "Shift"+Up"',[]),39:new M(39,"",[]),40:new M(40,"Left to focus parent",[]),41:new M(41,'Press "Delete" to delete the focused note',[])};class be{constructor(){this.notes={...Qt},this.uID=1,this.version=tt}loadFromJSON(e){let n;for(n in e.notes){var l=e.notes[n],s=new M(+n);s.children.set(l.children),s.markup.set(l.markup),this.notes[+n]=s}this.Update()}getCopyForDownload(){let e={version:this.version,notes:{}};return this.copyNotesWithoutOrphans(e.notes),e}copyNotesWithoutOrphans(e){return this.addNoteAndDescendants(this.notes[0],e),e}addNoteAndDescendants(e,n){if(n[e.id])return;n[e.id]={id:e.id,markup:X(e.markup),children:X(e.children)};const l=X(e.markup),s=/<a id="(\d+)" href="#0">/g;let o;for(;(o=s.exec(l))!==null;){const r=parseInt(o[1]);this.notes[r]&&this.addNoteAndDescendants(this.notes[r],n)}X(e.children).forEach((function(r){this.addNoteAndDescendants(this.notes[r],n)}).bind(this))}getPlainText(){let e={};return this.copyNotesWithoutOrphans(e),this.getNoteInPlainText(e,0,{},"")}getNoteInPlainText(e,n,l,s){if(l[n])return"";l[n]=!0;let o=e[n],r=o.markup,c=o.children;return s+r+`
`+c.map(i=>this.getNoteInPlainText(e,i,l,n==0?s:s+"-")).join(`
`)}addNewChild({parent:e}){var n=this.getNewNote();return e.add(n),n}getNoteByID(e){return this.notes[e]}getNextUID(){for(;this.uID in this.notes;)this.uID++;return this.uID}swapPlaces(e,n,l){for(var s=X(e.children),o=0;o<s.length;o++)if([n.id,l.id].includes(s[o])){[s[o],s[o+1]]=[s[o+1],s[o]];return}}getNewNote(){var e=this.getNextUID(),n=new M(e);return this.notes[e]=n,n}getRoot(){var e=this.notes[0];if(!e)throw new Error("no root found");return e}Merge(e,n){var l=e.notes[0],s=0,o=(function(){return s+=1,!(s in this.notes)&&!(s in e.notes)?s:o()}).bind(this),r;for(var r in e.notes){var c=o();e.editNoteId(+r,c)}this.notes={...this.notes,...e.notes};var p=X(this.getRoot().children).length==0;return p?(X(l.children).forEach(i=>{this.getRoot().add(this.notes[i])}),Oe().then(()=>{document.title=n})):(this.getRoot().add(l),l.markup.set(n)),l}editNoteId(e,n){var l=this.notes[e];l.id=n,delete this.notes[e],this.notes[n]=l;var s;for(s in this.notes){var l=this.notes[s];l.children.set(X(l.children).map(r=>r==e?n:r)),l.markup.set(String(X(l.markup)).replace(be.GetNoteLinkOpeningTag(e),be.GetNoteLinkOpeningTag(n)))}}Update(){for(this.version||(this.version=1);this.version<tt;)this.UpgradeByOneVersion()}UpgradeByOneVersion(){switch(this.version){}this.version++}static GetNoteLinkOpeningTag(e){return`<a id="${e}" href="#0">`}swapNotes(e,n,l){var s=X(e.children).map(function(o){return o==n.id?l.id:o==l.id?n.id:o});e.children.set(s)}}let re=new be,Zt=0;const $t=function(){return Zt++},we=ae(null),Te=ae(null),ke=ae([]),ne={copiedInstances:[],copyMode:"copy"},xt={MIN_TEXTBOX_HEIGHT:50,TRUNCATE_NOTES:!1},Fe=ae(xt);function nt(t,e,n){const l=t.slice();return l[2]=e[n],l[56]=e,l[57]=n,l}function lt(t,e,n){const l=t.slice();return l[2]=e[n],l[58]=e,l[57]=n,l}function st(t,e,n){const l=t.slice();return l[2]=e[n],l[59]=e,l[57]=n,l}function en(t){let e,n=[],l=new Map,s,o,r,c=t[12];const p=i=>i[2];for(let i=0;i<c.length;i+=1){let u=st(t,c,i),d=p(u);l.set(d,n[i]=ot(d,u))}return{c(){e=v("div");for(let i=0;i<n.length;i+=1)n[i].c();b(e,"id","notepad"),b(e,"class","svelte-1i9b4oe"),L(e,"isFocused",t[8])},m(i,u){R(i,e,u);for(let d=0;d<n.length;d+=1)n[d]&&n[d].m(e,null);s=!0,o||(r=O(e,"click",Ke(t[35])),o=!0)},p(i,u){u[0]&3149890&&(c=i[12],Se(),n=je(n,u,p,1,i,c,l,e,Je,ot,null,st),Ie()),(!s||u[0]&256)&&L(e,"isFocused",i[8])},i(i){if(!s){for(let u=0;u<c.length;u+=1)K(n[u]);s=!0}},o(i){for(let u=0;u<n.length;u+=1)J(n[u]);s=!1},d(i){i&&U(e);for(let u=0;u<n.length;u+=1)n[u].d();o=!1,r()}}}function ot(t,e){let n,l,s=e[57],o;const r=()=>e[33](l,s),c=()=>e[33](null,s);let p={noteId:e[2]};return l=new Ue({props:p}),r(),l.$on("SwapChildren",e[20]),l.$on("DeleteChild",e[21]),l.$on("Focus",e[34]),{key:t,first:null,c(){n=Me(),te(l.$$.fragment),this.first=n},m(i,u){R(i,n,u),x(l,i,u),o=!0},p(i,u){e=i,s!==e[57]&&(c(),s=e[57],r());const d={};u[0]&4096&&(d.noteId=e[2]),l.$set(d)},i(i){o||(K(l.$$.fragment,i),o=!0)},o(i){J(l.$$.fragment,i),o=!1},d(i){i&&U(n),c(),ee(l,i)}}}function tn(t){let e,n,l,s=t[3]?"v":">",o,r,c,p,i,u,d,a;function h(m,k){return m[10]?ln:nn}let _=h(t),y=_(t),C=t[4]&&it(t);return{c(){e=v("div"),n=v("div"),l=v("button"),o=$(s),r=T(),c=v("span"),y.c(),i=T(),C&&C.c(),b(l,"id","toggleButton"),b(l,"class","svelte-1i9b4oe"),L(l,"boldText",t[12].length>0),b(c,"id","text"),b(c,"class","svelte-1i9b4oe"),L(c,"truncated",t[9]&&!t[3]&&!t[8]&&!t[11]),b(n,"id","topRow"),b(n,"style",p=t[9]?"":"height:100%"),b(n,"class","svelte-1i9b4oe"),b(e,"class","noteContent svelte-1i9b4oe")},m(m,k){R(m,e,k),g(e,n),g(n,l),g(l,o),g(n,r),g(n,c),y.m(c,null),g(e,i),C&&C.m(e,null),u=!0,d||(a=[O(l,"click",Ke(t[36])),O(c,"click",Ke(t[39]))],d=!0)},p(m,k){(!u||k[0]&8)&&s!==(s=m[3]?"v":">")&&Le(o,s),(!u||k[0]&4096)&&L(l,"boldText",m[12].length>0),_===(_=h(m))&&y?y.p(m,k):(y.d(1),y=_(m),y&&(y.c(),y.m(c,null))),(!u||k[0]&2824)&&L(c,"truncated",m[9]&&!m[3]&&!m[8]&&!m[11]),(!u||k[0]&512&&p!==(p=m[9]?"":"height:100%"))&&b(n,"style",p),m[4]?C?(C.p(m,k),k[0]&16&&K(C,1)):(C=it(m),C.c(),K(C,1),C.m(e,null)):C&&(Se(),J(C,1,1,()=>{C=null}),Ie())},i(m){u||(K(C),u=!0)},o(m){J(C),u=!1},d(m){m&&U(e),y.d(),C&&C.d(),d=!1,Y(a)}}}function nn(t){let e,n,l;return{c(){e=v("span")},m(s,o){R(s,e,o),e.innerHTML=t[14],n||(l=O(e,"click",t[22]),n=!0)},p(s,o){o[0]&16384&&(e.innerHTML=s[14])},d(s){s&&U(e),n=!1,l()}}}function ln(t){let e,n,l;return{c(){e=v("textarea"),b(e,"class","svelte-1i9b4oe")},m(s,o){R(s,e,o),t[37](e),xe(e,t[14]),n||(l=[O(e,"input",t[38]),O(e,"input",t[23])],n=!0)},p(s,o){o[0]&16384&&xe(e,s[14])},d(s){s&&U(e),t[37](null),n=!1,Y(l)}}}function it(t){let e,n=[],l=new Map,s,o=[],r=new Map,c,p=t[12];const i=a=>a[2];for(let a=0;a<p.length;a+=1){let h=lt(t,p,a),_=i(h);l.set(_,n[a]=rt(_,h))}let u=t[13];const d=a=>a[2];for(let a=0;a<u.length;a+=1){let h=nt(t,u,a),_=d(h);r.set(_,o[a]=ct(_,h))}return{c(){e=v("div");for(let a=0;a<n.length;a+=1)n[a].c();s=T();for(let a=0;a<o.length;a+=1)o[a].c();b(e,"id","childContainer"),b(e,"class","svelte-1i9b4oe"),L(e,"hidden",!t[3])},m(a,h){R(a,e,h);for(let _=0;_<n.length;_+=1)n[_]&&n[_].m(e,null);g(e,s);for(let _=0;_<o.length;_+=1)o[_]&&o[_].m(e,null);c=!0},p(a,h){h[0]&3149890&&(p=a[12],Se(),n=je(n,h,i,1,a,p,l,e,Je,rt,s,lt),Ie()),h[0]&2105474&&(u=a[13],Se(),o=je(o,h,d,1,a,u,r,e,Je,ct,null,nt),Ie()),(!c||h[0]&8)&&L(e,"hidden",!a[3])},i(a){if(!c){for(let h=0;h<p.length;h+=1)K(n[h]);for(let h=0;h<u.length;h+=1)K(o[h]);c=!0}},o(a){for(let h=0;h<n.length;h+=1)J(n[h]);for(let h=0;h<o.length;h+=1)J(o[h]);c=!1},d(a){a&&U(e);for(let h=0;h<n.length;h+=1)n[h].d();for(let h=0;h<o.length;h+=1)o[h].d()}}}function rt(t,e){let n,l,s=e[57],o;const r=()=>e[40](l,s),c=()=>e[40](null,s);let p={noteId:e[2]};return l=new Ue({props:p}),r(),l.$on("SwapChildren",e[20]),l.$on("DeleteChild",e[21]),l.$on("Focus",e[41]),{key:t,first:null,c(){n=Me(),te(l.$$.fragment),this.first=n},m(i,u){R(i,n,u),x(l,i,u),o=!0},p(i,u){e=i,s!==e[57]&&(c(),s=e[57],r());const d={};u[0]&4096&&(d.noteId=e[2]),l.$set(d)},i(i){o||(K(l.$$.fragment,i),o=!0)},o(i){J(l.$$.fragment,i),o=!1},d(i){i&&U(n),c(),ee(l,i)}}}function ct(t,e){let n,l,s=e[57],o;const r=()=>e[42](l,s),c=()=>e[42](null,s);let p={noteId:e[2],isReference:!0};return l=new Ue({props:p}),r(),l.$on("DeleteChild",e[21]),l.$on("Focus",e[43]),{key:t,first:null,c(){n=Me(),te(l.$$.fragment),this.first=n},m(i,u){R(i,n,u),x(l,i,u),o=!0},p(i,u){e=i,s!==e[57]&&(c(),s=e[57],r());const d={};u[0]&8192&&(d.noteId=e[2]),l.$set(d)},i(i){o||(K(l.$$.fragment,i),o=!0)},o(i){J(l.$$.fragment,i),o=!1},d(i){i&&U(n),c(),ee(l,i)}}}function sn(t){let e,n,l,s=t[17]&&en(t),o=!t[17]&&tn(t);return{c(){e=v("div"),s&&s.c(),n=T(),o&&o.c(),b(e,"id","note "+t[15].id),b(e,"class","noteWrapper svelte-1i9b4oe"),b(e,"style",t[17]?"height: 100%;":""),L(e,"isSelected",t[11]),L(e,"isExpanded",t[3]),L(e,"isFocused",t[8]),L(e,"referenceContainer",t[0])},m(r,c){R(r,e,c),s&&s.m(e,null),g(e,n),o&&o.m(e,null),l=!0},p(r,c){r[17]&&s.p(r,c),r[17]||o.p(r,c),(!l||c[0]&2048)&&L(e,"isSelected",r[11]),(!l||c[0]&8)&&L(e,"isExpanded",r[3]),(!l||c[0]&256)&&L(e,"isFocused",r[8]),(!l||c[0]&1)&&L(e,"referenceContainer",r[0])},i(r){l||(K(s),K(o),l=!0)},o(r){J(s),J(o),l=!1},d(r){r&&U(e),s&&s.d(),o&&o.d()}}}function at(t,e){var n=t.selectionStart,l=t.selectionEnd;t.value=t.value.substring(0,n)+e+t.value.substring(l),t.selectionStart=t.selectionEnd=n+e.length}function on(t){return t.endsWith("*")?t.slice(0,-1):t}function rn(t,e,n){let l,s,o,r,c,p,i,u,d;he(t,ke,f=>n(30,r=f)),he(t,Te,f=>n(31,c=f)),he(t,we,f=>n(32,p=f));const a=Wt(),h=function(){a("DeleteChild",{target:D,isFocused:oe})},_=$t();let{noteId:y}=e,{isReference:C=!1}=e,k=re.notes[y];const D={note:k,noteId:y,instanceId:_,Delete:h};let w,N=[],A=ae([]);he(t,A,f=>n(13,u=f));let I=[];const H=y==0;let F=k.markup;he(t,F,f=>n(14,d=f));let V=k.children;he(t,V,f=>n(12,i=f));let j=!1;const Z=function(){n(3,j=!0)},de=async function(f){if(!(f<=0)){await Oe();var S=[...N,...I];S.forEach(P=>{P.Expand(),P.ExpandAll(f-1)})}};let oe=!1,{Focus:E=function(f=!1){if(p!=D&&Te.set(null),we.set(D),H){f||ke.set([]);return}else B(D,f)}}=e;D.Focus=E;let B=function(f,S){let P=S?[...r,f]:[f];ke.set(P)},Ne=function(f){let{child_to_swap:S,moveUp:P}=f.detail;var z=i.indexOf(S),G=z+(P?-1:1),Q=G>=0&&G<i.length;if(Q){let W=[...i];[W[z],W[G]]=[W[G],W[z]],V.set(W)}},Ct=function(f){let{target:S,isFocused:P}=f.detail;if(P){var z=De();let Q=z.indexOf(S);if(Q==1)E();else{var G=z[Q-1];we.set(G),ke.set([G])}}A.update(Q=>Q.filter(W=>W!=S.noteId)),V.set([...i.filter(Q=>Q!=S.note.id)])};const De=function(){var f=[D];if(j||H){var S=[...N,...I];S.forEach(P=>{if(P!=null){var z=[];z=P.getSortedGenespan(),f=f.concat(z)}})}return f};ye(()=>{window.addEventListener("keydown",Ve)}),Vt(()=>{window.removeEventListener("keydown",Ve)});function Ve(f){if(oe){if(f.stopImmediatePropagation(),!l)switch(f.key.toLowerCase()){case"arrowup":f.shiftKey&&a("SwapChildren",{child_to_swap:k.id,moveUp:!0});break;case"arrowdown":f.shiftKey&&a("SwapChildren",{child_to_swap:k.id,moveUp:!1});break;case"arrowleft":a("Focus",{keepSelection:f.ctrlKey});break;case"insert":f.preventDefault();var S=re.addNewChild({parent:k});n(3,j=!0),f.ctrlKey||Oe().then(()=>{De().forEach(z=>{z.note==S&&(we.set(z),ke.set([z]))})});break;case"tab":f.preventDefault(),n(3,j=!j),f.shiftKey&&de(2);break;case"enter":H||(f.preventDefault(),Te.set(D),Oe().then(()=>{w.focus(),B(D,!1),We()}));break;case"i":if(f.ctrlKey)debugger;break;case"c":f.ctrlKey&&(ne.copiedInstances=[...r],ne.copyMode="copy");break;case"x":f.ctrlKey&&(ne.copiedInstances=[...r],ne.copyMode="cut");break;case"v":ne.copiedInstances.forEach(function(P){var z=i.includes(P.noteId);z||(k.add(P.note),ne.copyMode=="cut"&&P.Delete())}),i.length>0&&n(3,j=!0);break;case"alt":f.preventDefault();break}if(l)switch(f.key.toLowerCase()){case"enter":break;case"alt":f.preventDefault(),Te.set(null);break;case"tab":f.preventDefault(),at(w,"	");break;case"b":f.ctrlKey&&ne.copiedInstances.length>0&&(f.preventDefault(),Et(w))}}}function Et(f){let S=ne.copiedInstances[0].note,P=be.GetNoteLinkOpeningTag(S.id)+"</a>";at(f,P),F.set(f.value)}function St(f){f.target.tagName==="A"&&(It(+f.target.id),Z())}function It(f){u.includes(f)||i.includes(f)||A.update(P=>[...P,f])}function We(){var f=Math.max(X(Fe).MIN_TEXTBOX_HEIGHT,w.scrollHeight)+"px";n(5,w.style.height=f,w)}H&&(ye(E),window.addEventListener("keydown",function(S){let P=function(z){for(var G=De(),Q,W=0;W<G.length;W++){var Ht=G[W];if(Ht==p){Q=W;break}}var Re=Q+(z?-1:1),zt=Re>=0&&Re<G.length;return zt?G[Re]:null};if((S.key=="ArrowUp"||S.key=="ArrowDown")&&c==null&&(S.preventDefault(),!S.shiftKey)){let z=S.key=="ArrowUp",G=P(z);G!=null&&(we.set(G),B(G,S.ctrlKey))}S.key=="Delete"&&r.forEach(z=>{z.Delete()})}));var Xe=function(){document.title.endsWith("*")||(document.title=document.title+"*")};let qe=!0;F.subscribe(f=>{if(qe){qe=!1;return}Xe()});let Ye=!0;V.subscribe(f=>{if(Ye){Ye=!1;return}Xe()}),H&&ye(()=>{document.title=on(document.title)});function Qe(){a("CloseHelp")}let Ze;const Nt=Fe.subscribe(f=>{n(9,Ze=f.TRUNCATE_NOTES)});ye(()=>()=>Nt());function Dt(f,S){le[f?"unshift":"push"](()=>{N[S]=f,n(6,N)})}const Tt=f=>{E(f.detail.keepSelection)},Ot=f=>{E(f.ctrlKey),Qe()},At=()=>{n(3,j=!j)};function Ft(f){le[f?"unshift":"push"](()=>{w=f,n(5,w)})}function Mt(){d=this.value,F.set(d)}const Lt=f=>{E(f.ctrlKey)};function Ut(f,S){le[f?"unshift":"push"](()=>{N[S]=f,n(6,N)})}const Rt=f=>{E(f.detail.keepSelection)};function Pt(f,S){le[f?"unshift":"push"](()=>{I[S]=f,n(7,I)})}const Kt=f=>{E(f.detail.keepSelection)};return t.$$set=f=>{"noteId"in f&&n(2,y=f.noteId),"isReference"in f&&n(0,C=f.isReference),"Focus"in f&&n(1,E=f.Focus)},t.$$.update=()=>{t.$$.dirty[0]&536870912|t.$$.dirty[1]&1&&n(10,l=c==D),t.$$.dirty[0]&24&&n(4,s=j||s),t.$$.dirty[0]&536870912|t.$$.dirty[1]&2&&n(8,oe=p===D),t.$$.dirty[0]&1610612736&&n(11,o=r.includes(D))},[C,E,y,j,s,w,N,I,oe,Ze,l,o,i,u,d,k,A,H,F,V,Ne,Ct,St,We,Qe,_,Z,de,De,D,r,c,p,Dt,Tt,Ot,At,Ft,Mt,Lt,Ut,Rt,Pt,Kt]}class Ue extends fe{constructor(e){super(),ue(this,e,rn,sn,se,{instanceId:25,noteId:2,isReference:0,Expand:26,ExpandAll:27,Focus:1,getSortedGenespan:28},null,[-1,-1])}get instanceId(){return this.$$.ctx[25]}get Expand(){return this.$$.ctx[26]}get ExpandAll(){return this.$$.ctx[27]}get getSortedGenespan(){return this.$$.ctx[28]}}const ve="tnpKeys";function Ge(t,e){try{cn(t,e),document.title=t}catch(n){if(n instanceof DOMException&&n.name==="QuotaExceededError")un()&&Ge(t,e);else throw n}}function cn(t,e){let n=JSON.parse(localStorage.getItem(ve)??"[]");if(!n.includes(t)){let l=[t,...n];localStorage.setItem(ve,JSON.stringify(l))}localStorage.setItem(t,e)}function an(t){let e=JSON.parse(localStorage.getItem(ve)??"[]");const n=e.indexOf(t);n>-1&&(e.splice(n,1),localStorage.removeItem(t),localStorage.setItem(ve,JSON.stringify(e)))}function un(){let t=JSON.parse(localStorage.getItem(ve)??"[]");if(t.length===0)return!1;const e=t[t.length-1];return t.pop(),localStorage.removeItem(e),localStorage.setItem(ve,JSON.stringify(t)),!0}function fn(t,e){let n;return function(...s){clearTimeout(n),n=setTimeout(()=>{t.apply(this,s)},e)}}function dn(t){return t.endsWith("*")?t.slice(0,-1):t}function hn(t){return ye(()=>{const l=fn(()=>{if(!document.title.endsWith("*"))return;const s=re.getCopyForDownload(),o=JSON.stringify(s);Ge(dn(document.title),o)},12e4);return document.addEventListener("keydown",l),document.addEventListener("mousedown",l),l(),()=>{document.removeEventListener("keydown",l),document.removeEventListener("mousedown",l)}}),[]}class pn extends fe{constructor(e){super(),ue(this,e,hn,null,se,{})}}function ut(t){let e,n,l,s,o,r,c,p,i,u;return{c(){e=v("div"),n=v("div"),l=v("p"),s=$(t[0]),o=T(),r=v("button"),r.textContent="Yes",c=T(),p=v("button"),p.textContent="No",b(r,"class","svelte-v3dq6t"),b(p,"class","svelte-v3dq6t"),b(n,"class","modal-content svelte-v3dq6t"),b(e,"class","modal svelte-v3dq6t")},m(d,a){R(d,e,a),g(e,n),g(n,l),g(l,s),g(n,o),g(n,r),g(n,c),g(n,p),i||(u=[O(r,"click",function(){ce(t[1])&&t[1].apply(this,arguments)}),O(p,"click",function(){ce(t[2])&&t[2].apply(this,arguments)})],i=!0)},p(d,a){t=d,a&1&&Le(s,t[0])},d(d){d&&U(e),i=!1,Y(u)}}}function _n(t){let e,n=t[3]&&ut(t);return{c(){n&&n.c(),e=Me()},m(l,s){n&&n.m(l,s),R(l,e,s)},p(l,[s]){l[3]?n?n.p(l,s):(n=ut(l),n.c(),n.m(e.parentNode,e)):n&&(n.d(1),n=null)},i:q,o:q,d(l){n&&n.d(l),l&&U(e)}}}function mn(t,e,n){let{message:l}=e,{onConfirm:s}=e,{onCancel:o}=e,{visible:r}=e;return t.$$set=c=>{"message"in c&&n(0,l=c.message),"onConfirm"in c&&n(1,s=c.onConfirm),"onCancel"in c&&n(2,o=c.onCancel),"visible"in c&&n(3,r=c.visible)},[l,s,o,r]}class gn extends fe{constructor(e){super(),ue(this,e,mn,_n,se,{message:0,onConfirm:1,onCancel:2,visible:3})}}function ft(t,e,n){const l=t.slice();return l[14]=e[n],l}function dt(t){let e,n,l,s,o,r,c,p,i,u=t[2],d=[];for(let a=0;a<u.length;a+=1)d[a]=ht(ft(t,u,a));return{c(){e=v("div"),n=v("div"),l=v("table"),s=v("tr"),o=v("td"),r=v("button"),r.textContent="×",c=T();for(let a=0;a<d.length;a+=1)d[a].c();b(r,"class","close-button svelte-9sk29o"),b(o,"colspan","2"),b(o,"class","svelte-9sk29o"),b(s,"class","header-row svelte-9sk29o"),b(l,"class","svelte-9sk29o"),b(n,"class","modal-content svelte-9sk29o"),b(e,"class","modal svelte-9sk29o")},m(a,h){R(a,e,h),g(e,n),g(n,l),g(l,s),g(s,o),g(o,r),g(l,c);for(let _=0;_<d.length;_+=1)d[_]&&d[_].m(l,null);p||(i=[O(r,"click",function(){ce(t[1])&&t[1].apply(this,arguments)}),O(r,"keypress",function(){ce(t[1])&&t[1].apply(this,arguments)})],p=!0)},p(a,h){if(t=a,h&102){u=t[2];let _;for(_=0;_<u.length;_+=1){const y=ft(t,u,_);d[_]?d[_].p(y,h):(d[_]=ht(y),d[_].c(),d[_].m(l,null))}for(;_<d.length;_+=1)d[_].d(1);d.length=u.length}},d(a){a&&U(e),bt(d,a),p=!1,Y(i)}}}function ht(t){let e,n,l,s=t[14]+"",o,r,c,p,i,u;function d(){return t[10](t[14])}function a(){return t[11](t[14])}function h(){return t[12](t[14])}return{c(){e=v("tr"),n=v("td"),l=v("button"),o=$(s),r=T(),c=v("td"),c.textContent="x",p=T(),b(l,"class","filename-button svelte-9sk29o"),b(n,"class","filename svelte-9sk29o"),b(c,"class","delete-button svelte-9sk29o"),b(e,"class","svelte-9sk29o")},m(_,y){R(_,e,y),g(e,n),g(n,l),g(l,o),g(e,r),g(e,c),g(e,p),i||(u=[O(l,"click",d),O(c,"click",a),O(c,"keypress",h)],i=!0)},p(_,y){t=_,y&4&&s!==(s=t[14]+"")&&Le(o,s)},d(_){_&&U(e),i=!1,Y(u)}}}function bn(t){let e,n,l,s=t[0]&&dt(t);return n=new gn({props:{message:`Are you sure you want to delete ${t[4]}?`,onConfirm:t[7],onCancel:t[8],visible:t[3]}}),{c(){s&&s.c(),e=T(),te(n.$$.fragment)},m(o,r){s&&s.m(o,r),R(o,e,r),x(n,o,r),l=!0},p(o,[r]){o[0]?s?s.p(o,r):(s=dt(o),s.c(),s.m(e.parentNode,e)):s&&(s.d(1),s=null);const c={};r&16&&(c.message=`Are you sure you want to delete ${o[4]}?`),r&8&&(c.visible=o[3]),n.$set(c)},i(o){l||(K(n.$$.fragment,o),l=!0)},o(o){J(n.$$.fragment,o),l=!1},d(o){s&&s.d(o),o&&U(e),ee(n,o)}}}function vn(t,e,n){let{visible:l=!1}=e,{toggleModal:s}=e,{merge_tnp_file:o}=e,r=[],c=!1,p="";function i(){n(2,r=JSON.parse(localStorage.getItem("tnpKeys"))??[])}function u(m){const k=localStorage.getItem(m);o(k,m)}function d(m){n(4,p=m),n(3,c=!0)}function a(){an(p),i(),n(3,c=!1)}function h(){n(3,c=!1)}const _=m=>{u(m),s()},y=m=>d(m),C=m=>d(m);return t.$$set=m=>{"visible"in m&&n(0,l=m.visible),"toggleModal"in m&&n(1,s=m.toggleModal),"merge_tnp_file"in m&&n(9,o=m.merge_tnp_file)},t.$$.update=()=>{t.$$.dirty&1&&l&&i()},[l,s,r,c,p,u,d,a,h,o,_,y,C]}class wn extends fe{constructor(e){super(),ue(this,e,vn,bn,se,{visible:0,toggleModal:1,merge_tnp_file:9})}}function kn(t){let e,n,l,s,o,r,c,p,i,u,d,a,h,_,y,C,m,k,D,w,N,A,I,H,F,V,j,Z,de,oe;return F=new wn({props:{visible:t[2],toggleModal:t[9],merge_tnp_file:t[6]}}),j=new pn({}),{c(){e=v("div"),n=v("button"),n.textContent="File",l=T(),s=v("div"),o=v("button"),o.textContent="Download to Computer",r=T(),c=v("button"),p=$(`Upload from Computer\r
        `),i=v("input"),u=T(),d=v("button"),d.textContent="Save in browser",a=T(),h=v("button"),h.textContent="Load from browser",_=T(),y=v("button"),y.textContent="Save as text",C=T(),m=v("div"),k=v("button"),k.textContent="View",D=T(),w=v("div"),N=v("label"),A=v("input"),I=$(`\r
        Truncate notes`),H=T(),te(F.$$.fragment),V=T(),te(j.$$.fragment),b(n,"class","dropdown-button svelte-1lxzdp"),b(o,"class","svelte-1lxzdp"),b(i,"type","file"),b(i,"accept",".tnp"),Bt(i,"display","none"),b(c,"class","svelte-1lxzdp"),b(d,"class","svelte-1lxzdp"),b(h,"class","svelte-1lxzdp"),b(y,"class","svelte-1lxzdp"),b(s,"id","FileDropdown"),b(s,"class","dropdown-content svelte-1lxzdp"),L(s,"hidden",!t[3]),b(e,"class","dropdown svelte-1lxzdp"),b(k,"class","dropdown-button svelte-1lxzdp"),b(A,"type","checkbox"),A.checked=t[5],b(N,"class","svelte-1lxzdp"),b(w,"id","ViewDropdown"),b(w,"class","dropdown-content svelte-1lxzdp"),L(w,"hidden",!t[4]),b(m,"class","dropdown svelte-1lxzdp")},m(E,B){R(E,e,B),g(e,n),g(e,l),g(e,s),g(s,o),g(s,r),g(s,c),g(c,p),g(c,i),t[15](i),g(s,u),g(s,d),g(s,a),g(s,h),g(s,_),g(s,y),R(E,C,B),R(E,m,B),g(m,k),g(m,D),g(m,w),g(w,N),g(N,A),g(N,I),R(E,H,B),x(F,E,B),R(E,V,B),x(j,E,B),Z=!0,de||(oe=[O(n,"click",t[11]),O(o,"click",function(){ce(t[0])&&t[0].apply(this,arguments)}),O(i,"change",t[7]),O(c,"click",t[16]),O(d,"click",t[8]),O(h,"click",t[9]),O(y,"click",t[13]),O(k,"click",t[10]),O(A,"change",t[12])],de=!0)},p(E,[B]){t=E,(!Z||B&8)&&L(s,"hidden",!t[3]),(!Z||B&32)&&(A.checked=t[5]),(!Z||B&16)&&L(w,"hidden",!t[4]);const Ne={};B&4&&(Ne.visible=t[2]),F.$set(Ne)},i(E){Z||(K(F.$$.fragment,E),K(j.$$.fragment,E),Z=!0)},o(E){J(F.$$.fragment,E),J(j.$$.fragment,E),Z=!1},d(E){E&&U(e),t[15](null),E&&U(C),E&&U(m),E&&U(H),ee(F,E),E&&U(V),ee(j,E),de=!1,Y(oe)}}}function yn(t){return t.slice(0,-4)}function Cn(){document.title=yt(document.title)}function yt(t){return t.endsWith("*")?t.slice(0,-1):t}function En(t){var e=document.createElement("a");e.setAttribute("href",URL.createObjectURL(t)),e.setAttribute("download",document.title+".tnp"),e.click()}function pt(t,e){const n=l=>{!l.target.closest("#"+t)&&(e(),document.removeEventListener("mousedown",n))};setTimeout(()=>{document.addEventListener("mousedown",n)},0)}function Sn(t,e,n){let l;function s(w,N){let A=new be,I=JSON.parse(w);A.loadFromJSON(I),re.Merge(A,N)}let o=async function(){let w=Array.from(l.files);for(var N=0;N<w.length;N++){var A=w[N];await r(A)}n(1,l.value="",l)};async function r(w){if(w.name.endsWith(".tnp")){var N=await w.text();s(N,yn(w.name))}}let{download:c=function(){var w=re.getCopyForDownload(),N=JSON.stringify(w),A=new Blob([N],{type:"application/octet-binary"});En(A),Cn()}}=e;function p(){let w=prompt("Enter filename:",yt(document.title));if(w!==null&&w!==""){let N=re.getCopyForDownload(),A=JSON.stringify(N);Ge(w,A)}}let i=!1;function u(){n(2,i=!i)}let d=!1,a=!1;function h(){n(4,a=!a),n(3,d=!1),a&&pt("ViewDropdown",()=>{n(4,a=!1)})}function _(){n(3,d=!d),d&&pt("FileDropdown",()=>{n(3,d=!1)})}let y;Fe.subscribe(w=>{n(5,y=w.TRUNCATE_NOTES)});function C(){Fe.update(w=>({...w,TRUNCATE_NOTES:!w.TRUNCATE_NOTES}))}function m(){let w=re.getPlainText();console.log(w)}function k(w){le[w?"unshift":"push"](()=>{l=w,n(1,l)})}const D=()=>l.click();return t.$$set=w=>{"download"in w&&n(0,c=w.download)},[c,l,i,d,a,y,s,o,p,u,h,_,C,m,r,k,D]}class In extends fe{constructor(e){super(),ue(this,e,Sn,kn,se,{uploadOneFile:14,download:0})}get uploadOneFile(){return this.$$.ctx[14]}}function Nn(t,e,n){const l=t.slice();return l[0]=e[n][0],l[1]=e[n][1],l}function Dn(t){let e,n,l,s,o,r,c;return{c(){e=v("tr"),n=v("td"),l=$(t[0]),s=T(),o=v("td"),r=$(t[1]),c=T(),b(n,"class","svelte-ci6f7i"),b(o,"class","svelte-ci6f7i")},m(p,i){R(p,e,i),g(e,n),g(n,l),g(e,s),g(e,o),g(o,r),g(e,c)},p:q,d(p){p&&U(e)}}}function Tn(t){let e,n,l,s,o,r,c,p=[["Insert","Add a new note under the focused one"],["Delete","Delete selected notes"],["Up/Down Arrow","Move focus up/down"],["Enter","Make a note editable"],["Alt","Return an editable note to being uneditable"],["Shift+Up/Down","Swap Adjacent Siblings"],["Click on note","Focuses note"],["Ctrl+Focus Note","Keeps notes selected while focusing new one"],["Ctrl+C/X/V","Copy/Cut/Paste selected notes"],["Ctrl+B","Paste a reference of the copied note into the text box"],["Tab","Toggles whether focused note is expanded"],["Tab+Shift","Also expands children and grandchildren"]],i=[];for(let u=0;u<12;u+=1)i[u]=Dn(Nn(t,p,u));return{c(){e=v("div"),n=v("div"),n.innerHTML="<h2>Controls</h2>",l=T(),s=v("table"),o=v("thead"),o.innerHTML=`<tr><th class="svelte-ci6f7i">Command</th> 
            <th class="svelte-ci6f7i">Description</th></tr>`,r=T(),c=v("tbody");for(let u=0;u<12;u+=1)i[u].c();b(n,"class","title svelte-ci6f7i"),b(s,"class","svelte-ci6f7i"),b(e,"class","menu svelte-ci6f7i")},m(u,d){R(u,e,d),g(e,n),g(e,l),g(e,s),g(s,o),g(s,r),g(s,c);for(let a=0;a<12;a+=1)i[a]&&i[a].m(c,null)},p:q,i:q,o:q,d(u){u&&U(e),bt(i,u)}}}class On extends fe{constructor(e){super(),ue(this,e,null,Tn,se,{})}}function _t(t){let e,n,l;return n=new On({}),{c(){e=v("div"),te(n.$$.fragment),b(e,"id","helpWrapper"),b(e,"class","svelte-x4pe8j")},m(s,o){R(s,e,o),x(n,e,null),l=!0},i(s){l||(K(n.$$.fragment,s),l=!0)},o(s){J(n.$$.fragment,s),l=!1},d(s){s&&U(e),ee(n)}}}function An(t){let e,n,l,s,o,r,c=t[1]?"X":"?",p,i,u,d,a,h,_,y,C={};s=new In({props:C}),t[7](s);let m=t[1]&&_t();return a=new Ue({props:{noteId:0}}),a.$on("CloseHelp",t[3]),{c(){e=v("main"),n=v("div"),l=v("span"),te(s.$$.fragment),o=T(),r=v("button"),p=$(c),i=T(),m&&m.c(),u=T(),d=v("div"),te(a.$$.fragment),b(l,"id","Menubar"),b(l,"class","svelte-x4pe8j"),b(r,"class","svelte-x4pe8j"),L(r,"close-btn",t[1]),b(n,"id","Topbar"),b(n,"class","svelte-x4pe8j"),b(d,"class","notepad svelte-x4pe8j"),b(e,"class","svelte-x4pe8j"),L(e,"dragging",t[2])},m(k,D){R(k,e,D),g(e,n),g(n,l),x(s,l,null),g(n,o),g(n,r),g(r,p),g(e,i),m&&m.m(e,null),g(e,u),g(e,d),x(a,d,null),h=!0,_||(y=[O(r,"click",t[8]),O(e,"dragover",t[4]),O(e,"dragleave",t[5]),O(e,"drop",t[6])],_=!0)},p(k,[D]){const w={};s.$set(w),(!h||D&2)&&c!==(c=k[1]?"X":"?")&&Le(p,c),(!h||D&2)&&L(r,"close-btn",k[1]),k[1]?m?D&2&&K(m,1):(m=_t(),m.c(),K(m,1),m.m(e,u)):m&&(Se(),J(m,1,1,()=>{m=null}),Ie()),(!h||D&4)&&L(e,"dragging",k[2])},i(k){h||(K(s.$$.fragment,k),K(m),K(a.$$.fragment,k),h=!0)},o(k){J(s.$$.fragment,k),J(m),J(a.$$.fragment,k),h=!1},d(k){k&&U(e),t[7](null),ee(s),m&&m.d(),ee(a),_=!1,Y(y)}}}function Fn(t,e,n){let l,s=!1,o=!1,r=function(){n(1,s=!1)};function c(a){a.preventDefault(),n(2,o=!0)}function p(){n(2,o=!1)}function i(a){var h;if(a.preventDefault(),n(2,o=!1),(h=a.dataTransfer)!=null&&h.files.length){const _=a.dataTransfer.files[0];l.uploadOneFile(_)}}function u(a){le[a?"unshift":"push"](()=>{l=a,n(0,l)})}return[l,s,o,r,c,p,i,u,()=>n(1,s=!s)]}class Mn extends fe{constructor(e){super(),ue(this,e,Fn,An,se,{})}}new Mn({target:document.getElementById("app")});
