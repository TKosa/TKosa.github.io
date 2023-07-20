(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const l of s.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();function P(){}function Ve(t){return t()}function Me(){return Object.create(null)}function J(t){t.forEach(Ve)}function Qe(t){return typeof t=="function"}function be(t,e){return t!=t?e==e:t!==e||t&&typeof t=="object"||typeof t=="function"}function gt(t){return Object.keys(t).length===0}function Xe(t,...e){if(t==null)return P;const n=t.subscribe(...e);return n.unsubscribe?()=>n.unsubscribe():n}function M(t){let e;return Xe(t,n=>e=n)(),e}function ne(t,e,n){t.$$.on_destroy.push(Xe(e,n))}function K(t,e){t.appendChild(e)}function R(t,e,n){t.insertBefore(e,n||null)}function A(t){t.parentNode&&t.parentNode.removeChild(t)}function L(t){return document.createElement(t)}function ve(t){return document.createTextNode(t)}function x(){return ve(" ")}function ye(){return ve("")}function V(t,e,n,r){return t.addEventListener(e,n,r),()=>t.removeEventListener(e,n,r)}function Ye(t){return function(e){return e.stopPropagation(),t.call(this,e)}}function b(t,e,n){n==null?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function mt(t){return Array.from(t.childNodes)}function bt(t,e){e=""+e,t.data!==e&&(t.data=e)}function Ke(t,e){t.value=e??""}function vt(t,e,n,r){n==null?t.style.removeProperty(e):t.style.setProperty(e,n,r?"important":"")}function T(t,e,n){t.classList[n?"add":"remove"](e)}function yt(t,e,{bubbles:n=!1,cancelable:r=!1}={}){const i=document.createEvent("CustomEvent");return i.initCustomEvent(t,n,r,e),i}let le;function se(t){le=t}function Oe(){if(!le)throw new Error("Function called outside component initialization");return le}function Re(t){Oe().$$.on_mount.push(t)}function wt(t){Oe().$$.on_destroy.push(t)}function kt(){const t=Oe();return(e,n,{cancelable:r=!1}={})=>{const i=t.$$.callbacks[e];if(i){const s=yt(e,n,{cancelable:r});return i.slice().forEach(l=>{l.call(t,s)}),!s.defaultPrevented}return!0}}const Y=[],q=[];let Z=[];const $e=[],Ze=Promise.resolve();let De=!1;function xe(){De||(De=!0,Ze.then(et))}function Te(){return xe(),Ze}function Se(t){Z.push(t)}const Ie=new Set;let Q=0;function et(){if(Q!==0)return;const t=le;do{try{for(;Q<Y.length;){const e=Y[Q];Q++,se(e),Et(e.$$)}}catch(e){throw Y.length=0,Q=0,e}for(se(null),Y.length=0,Q=0;q.length;)q.pop()();for(let e=0;e<Z.length;e+=1){const n=Z[e];Ie.has(n)||(Ie.add(n),n())}Z.length=0}while(Y.length);for(;$e.length;)$e.pop()();De=!1,Ie.clear(),se(t)}function Et(t){if(t.fragment!==null){t.update(),J(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(Se)}}function It(t){const e=[],n=[];Z.forEach(r=>t.indexOf(r)===-1?e.push(r):n.push(r)),n.forEach(r=>r()),Z=e}const _e=new Set;let H;function ge(){H={r:0,c:[],p:H}}function me(){H.r||J(H.c),H=H.p}function C(t,e){t&&t.i&&(_e.delete(t),t.i(e))}function $(t,e,n,r){if(t&&t.o){if(_e.has(t))return;_e.add(t),H.c.push(()=>{_e.delete(t),r&&(n&&t.d(1),r())}),t.o(e)}else r&&r()}function Ce(t,e){$(t,1,1,()=>{e.delete(t.key)})}function Fe(t,e,n,r,i,s,l,a,p,o,c,h){let d=t.length,f=s.length,_=d;const m={};for(;_--;)m[t[_].key]=_;const g=[],y=new Map,N=new Map,E=[];for(_=f;_--;){const w=h(i,s,_),F=n(w);let D=l.get(F);D?r&&E.push(()=>D.p(w,e)):(D=o(F,w),D.c()),y.set(F,g[_]=D),F in m&&N.set(F,Math.abs(_-m[F]))}const z=new Set,j=new Set;function W(w){C(w,1),w.m(a,c),l.set(w.key,w),c=w.first,f--}for(;d&&f;){const w=g[f-1],F=t[d-1],D=w.key,O=F.key;w===F?(c=w.first,d--,f--):y.has(O)?!l.has(D)||z.has(D)?W(w):j.has(O)?d--:N.get(D)>N.get(O)?(j.add(D),W(w)):(z.add(O),d--):(p(F,l),d--)}for(;d--;){const w=t[d];y.has(w.key)||p(w,l)}for(;f;)W(g[f-1]);return J(E),g}function ce(t){t&&t.c()}function ee(t,e,n,r){const{fragment:i,after_update:s}=t.$$;i&&i.m(e,n),r||Se(()=>{const l=t.$$.on_mount.map(Ve).filter(Qe);t.$$.on_destroy?t.$$.on_destroy.push(...l):J(l),t.$$.on_mount=[]}),s.forEach(Se)}function te(t,e){const n=t.$$;n.fragment!==null&&(It(n.after_update),J(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function Nt(t,e){t.$$.dirty[0]===-1&&(Y.push(t),xe(),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function Le(t,e,n,r,i,s,l,a=[-1]){const p=le;se(t);const o=t.$$={fragment:null,ctx:[],props:s,update:P,not_equal:i,bound:Me(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(e.context||(p?p.$$.context:[])),callbacks:Me(),dirty:a,skip_bound:!1,root:e.target||p.$$.root};l&&l(o.root);let c=!1;if(o.ctx=n?n(t,e.props||{},(h,d,...f)=>{const _=f.length?f[0]:d;return o.ctx&&i(o.ctx[h],o.ctx[h]=_)&&(!o.skip_bound&&o.bound[h]&&o.bound[h](_),c&&Nt(t,h)),d}):[],o.update(),c=!0,J(o.before_update),o.fragment=r?r(o.ctx):!1,e.target){if(e.hydrate){const h=mt(e.target);o.fragment&&o.fragment.l(h),h.forEach(A)}else o.fragment&&o.fragment.c();e.intro&&C(t.$$.fragment),ee(t,e.target,e.anchor,e.customElement),et()}se(p)}class Ae{$destroy(){te(this,1),this.$destroy=P}$on(e,n){if(!Qe(n))return P;const r=this.$$.callbacks[e]||(this.$$.callbacks[e]=[]);return r.push(n),()=>{const i=r.indexOf(n);i!==-1&&r.splice(i,1)}}$set(e){this.$$set&&!gt(e)&&(this.$$.skip_bound=!0,this.$$set(e),this.$$.skip_bound=!1)}}const X=[];function ue(t,e=P){let n;const r=new Set;function i(a){if(be(t,a)&&(t=a,n)){const p=!X.length;for(const o of r)o[1](),X.push(o,t);if(p){for(let o=0;o<X.length;o+=2)X[o][0](X[o+1]);X.length=0}}}function s(a){i(a(t))}function l(a,p=P){const o=[a,p];return r.add(o),r.size===1&&(n=e(i)||P),a(t),()=>{r.delete(o),r.size===0&&n&&(n(),n=null)}}return{set:i,update:s,subscribe:l}}class he{constructor(e,n="",r=[]){this.id=e,this.markup=ue(n),this.children=ue(r)}add(e){M(this.children).includes(e.id)||this.children.set([...M(this.children),e.id])}}const Be=2;class ae{constructor(){var e=new he(0);this.notes={0:e},this.uID=1,this.version=Be}reset(){var e=new he(0);this.notes={0:e},this.uID=1}loadFromJSON(e){var n;for(n in e.notes){var r=e.notes[n],i=new he(n);i.children.set(M(r.children)),i.markup.set(M(r.markup)),this.notes[n]=i}}getCopyForDownload(){let e=(function(r){let i=(function(s,l){l[s.id]||(l[s.id]={id:s.id,markup:M(s.markup),children:M(s.children)},M(s.children).forEach((function(a){i(this.notes[a],l)}).bind(this)))}).bind(this);return i(this.notes[0],r),r}).bind(this),n={version:this.version,notes:{}};return e(n.notes),n}addNewChild({parent:e}){var n=this.getNewNote();return e.add(n),n}getNoteByID(e){return this.notes[e]}getNextUID(){for(;this.uID in this.notes;)this.uID++;return this.uID}swapPlaces(e,n,r){for(var i=M(e.children),s=0;s<i.length;s++)if([n.id,r.id].includes(i[s])){[i[s],i[s+1]]=[i[s+1],i[s]];return}}getNewNote(){var e=this.getNextUID(),n=new he(e);return this.notes[e]=n,n}getRoot(){var e=this.notes[0];if(!e)throw new Error("no root found");return e}Merge(e){var n=e.notes[0],r=0,i=(function(){return r+=1,!(r in this.notes)&&!(r in e.notes)?r:i()}).bind(this),s;for(var s in e.notes){var l=i();e.editNoteId(+s,l)}this.notes={...this.notes,...e.notes};var a=M(this.getRoot().children).length==0;return a?M(n.children).forEach(p=>{this.getRoot().add(this.notes[p])}):this.getRoot().add(n),n}editNoteId(e,n){var r=this.notes[e];r.id=n,delete this.notes[e],this.notes[n]=r;var i;for(i in this.notes){var r=this.notes[i];r.children.set(M(r.children).map(l=>l==e?n:l)),r.markup.set(String(M(r.markup)).replace(ae.GetNoteLinkOpeningTag(e),ae.GetNoteLinkOpeningTag(n)))}}Update(){for(this.version||(this.version=1);this.version<Be;)this.UpgradeByOneVersion()}UpgradeByOneVersion(){switch(this.version){}this.version++}static GetNoteLinkOpeningTag(e){return`<a id="${e}" href="#0">`}swapNotes(e,n,r){var i=M(e.children).map(function(s){return s==n.id?r.id:s==r.id?n.id:s});e.children.set(i)}}let oe=new ae,Dt=0;const St=function(){return Dt++},re=ue(null),pe=ue(null),ie=ue([]),Ne={copiedInstances:[]};function Pe(t,e,n){const r=t.slice();return r[2]=e[n],r[43]=e,r[44]=n,r}function Ge(t,e,n){const r=t.slice();return r[2]=e[n],r[45]=e,r[44]=n,r}function ze(t,e,n){const r=t.slice();return r[2]=e[n],r[46]=e,r[44]=n,r}function Ct(t){let e,n=[],r=new Map,i,s,l,a=t[12];const p=o=>o[2];for(let o=0;o<a.length;o+=1){let c=ze(t,a,o),h=p(c);r.set(h,n[o]=Je(h,c))}return{c(){e=L("div");for(let o=0;o<n.length;o+=1)n[o].c();b(e,"id","notepad"),b(e,"class","svelte-1w5aamk"),T(e,"isFocused",t[9])},m(o,c){R(o,e,c);for(let h=0;h<n.length;h+=1)n[h]&&n[h].m(e,null);i=!0,s||(l=V(e,"click",Ye(t[28])),s=!0)},p(o,c){c[0]&790594&&(a=o[12],ge(),n=Fe(n,c,p,1,o,a,r,e,Ce,Je,null,ze),me()),(!i||c[0]&512)&&T(e,"isFocused",o[9])},i(o){if(!i){for(let c=0;c<a.length;c+=1)C(n[c]);i=!0}},o(o){for(let c=0;c<n.length;c+=1)$(n[c]);i=!1},d(o){o&&A(e);for(let c=0;c<n.length;c+=1)n[c].d();s=!1,l()}}}function Je(t,e){let n,r,i=e[44],s;const l=()=>e[26](r,i),a=()=>e[26](null,i);let p={noteId:e[2]};return r=new we({props:p}),l(),r.$on("SwapChildren",e[18]),r.$on("DeleteChild",e[19]),r.$on("Focus",e[27]),{key:t,first:null,c(){n=ye(),ce(r.$$.fragment),this.first=n},m(o,c){R(o,n,c),ee(r,o,c),s=!0},p(o,c){e=o,i!==e[44]&&(a(),i=e[44],l());const h={};c[0]&4096&&(h.noteId=e[2]),r.$set(h)},i(o){s||(C(r.$$.fragment,o),s=!0)},o(o){$(r.$$.fragment,o),s=!1},d(o){o&&A(n),a(),te(r,o)}}}function Ft(t){let e,n,r=t[3]?"v":">",i,s,l,a,p,o,c,h;function d(g,y){return g[10]?Lt:Ot}let f=d(t),_=f(t),m=t[4]&&je(t);return{c(){e=L("div"),n=L("button"),i=ve(r),s=x(),l=L("span"),_.c(),a=x(),m&&m.c(),p=ye(),b(n,"id","toggleButton"),b(n,"class","svelte-1w5aamk"),T(n,"boldText",t[12].length>0),b(l,"id","text"),b(l,"class","svelte-1w5aamk"),b(e,"id","topRow"),b(e,"class","svelte-1w5aamk")},m(g,y){R(g,e,y),K(e,n),K(n,i),K(e,s),K(e,l),_.m(l,null),R(g,a,y),m&&m.m(g,y),R(g,p,y),o=!0,c||(h=[V(n,"click",t[29]),V(l,"click",Ye(t[32]))],c=!0)},p(g,y){(!o||y[0]&8)&&r!==(r=g[3]?"v":">")&&bt(i,r),(!o||y[0]&4096)&&T(n,"boldText",g[12].length>0),f===(f=d(g))&&_?_.p(g,y):(_.d(1),_=f(g),_&&(_.c(),_.m(l,null))),g[4]?m?(m.p(g,y),y[0]&16&&C(m,1)):(m=je(g),m.c(),C(m,1),m.m(p.parentNode,p)):m&&(ge(),$(m,1,1,()=>{m=null}),me())},i(g){o||(C(m),o=!0)},o(g){$(m),o=!1},d(g){g&&A(e),_.d(),g&&A(a),m&&m.d(g),g&&A(p),c=!1,J(h)}}}function Ot(t){let e;return{c(){e=L("span")},m(n,r){R(n,e,r),e.innerHTML=t[13]},p(n,r){r[0]&8192&&(e.innerHTML=n[13])},d(n){n&&A(e)}}}function Lt(t){let e,n,r;return{c(){e=L("textarea"),b(e,"class","svelte-1w5aamk")},m(i,s){R(i,e,s),t[30](e),Ke(e,t[13]),n||(r=V(e,"input",t[31]),n=!0)},p(i,s){s[0]&8192&&Ke(e,i[13])},d(i){i&&A(e),t[30](null),n=!1,r()}}}function je(t){let e,n=[],r=new Map,i,s=[],l=new Map,a,p=t[12];const o=d=>d[2];for(let d=0;d<p.length;d+=1){let f=Ge(t,p,d),_=o(f);r.set(_,n[d]=We(_,f))}let c=t[8];const h=d=>d[2];for(let d=0;d<c.length;d+=1){let f=Pe(t,c,d),_=h(f);l.set(_,s[d]=qe(_,f))}return{c(){e=L("div");for(let d=0;d<n.length;d+=1)n[d].c();i=x();for(let d=0;d<s.length;d+=1)s[d].c();b(e,"id","childContainer"),b(e,"class","svelte-1w5aamk"),T(e,"hidden",!t[3])},m(d,f){R(d,e,f);for(let _=0;_<n.length;_+=1)n[_]&&n[_].m(e,null);K(e,i);for(let _=0;_<s.length;_+=1)s[_]&&s[_].m(e,null);a=!0},p(d,f){f[0]&790594&&(p=d[12],ge(),n=Fe(n,f,o,1,d,p,r,e,Ce,We,i,Ge),me()),f[0]&524674&&(c=d[8],ge(),s=Fe(s,f,h,1,d,c,l,e,Ce,qe,null,Pe),me()),(!a||f[0]&8)&&T(e,"hidden",!d[3])},i(d){if(!a){for(let f=0;f<p.length;f+=1)C(n[f]);for(let f=0;f<c.length;f+=1)C(s[f]);a=!0}},o(d){for(let f=0;f<n.length;f+=1)$(n[f]);for(let f=0;f<s.length;f+=1)$(s[f]);a=!1},d(d){d&&A(e);for(let f=0;f<n.length;f+=1)n[f].d();for(let f=0;f<s.length;f+=1)s[f].d()}}}function We(t,e){let n,r,i=e[44],s;const l=()=>e[33](r,i),a=()=>e[33](null,i);let p={noteId:e[2]};return r=new we({props:p}),l(),r.$on("SwapChildren",e[18]),r.$on("DeleteChild",e[19]),r.$on("Focus",e[34]),{key:t,first:null,c(){n=ye(),ce(r.$$.fragment),this.first=n},m(o,c){R(o,n,c),ee(r,o,c),s=!0},p(o,c){e=o,i!==e[44]&&(a(),i=e[44],l());const h={};c[0]&4096&&(h.noteId=e[2]),r.$set(h)},i(o){s||(C(r.$$.fragment,o),s=!0)},o(o){$(r.$$.fragment,o),s=!1},d(o){o&&A(n),a(),te(r,o)}}}function qe(t,e){let n,r,i=e[44],s;const l=()=>e[35](r,i),a=()=>e[35](null,i);let p={noteId:e[2],isReference:!0};return r=new we({props:p}),l(),r.$on("DeleteChild",e[19]),r.$on("Focus",e[36]),{key:t,first:null,c(){n=ye(),ce(r.$$.fragment),this.first=n},m(o,c){R(o,n,c),ee(r,o,c),s=!0},p(o,c){e=o,i!==e[44]&&(a(),i=e[44],l());const h={};c[0]&256&&(h.noteId=e[2]),r.$set(h)},i(o){s||(C(r.$$.fragment,o),s=!0)},o(o){$(r.$$.fragment,o),s=!1},d(o){o&&A(n),a(),te(r,o)}}}function At(t){let e,n,r,i=t[15]&&Ct(t),s=!t[15]&&Ft(t);return{c(){e=L("div"),i&&i.c(),n=x(),s&&s.c(),b(e,"id","note "+t[14].id),b(e,"class","noteWrapper svelte-1w5aamk"),b(e,"style",t[15]?"height: 100%;":""),T(e,"selected",t[11]),T(e,"isFocused",t[9]),T(e,"referenceContainer",t[0])},m(l,a){R(l,e,a),i&&i.m(e,null),K(e,n),s&&s.m(e,null),r=!0},p(l,a){l[15]&&i.p(l,a),l[15]||s.p(l,a),(!r||a[0]&2048)&&T(e,"selected",l[11]),(!r||a[0]&512)&&T(e,"isFocused",l[9]),(!r||a[0]&1)&&T(e,"referenceContainer",l[0])},i(l){r||(C(i),C(s),r=!0)},o(l){$(i),$(s),r=!1},d(l){l&&A(e),i&&i.d(),s&&s.d()}}}function Ut(t,e,n){let r,i,s,l,a,p,o,c;ne(t,ie,u=>n(23,l=u)),ne(t,pe,u=>n(24,a=u)),ne(t,re,u=>n(25,p=u));const h=kt(),d=function(){h("DeleteChild",{target:N,isFocused:fe})},f=St();let{noteId:_}=e,{isReference:m=!1}=e,y=oe.notes[_];const N={note:y,noteId:_,instanceId:f,Delete:d};let E,z=[],j=[],W=[];const w=_==0;let F=y.markup;ne(t,F,u=>n(13,c=u));let D=y.children;ne(t,D,u=>n(12,o=u));let O=!1,fe=!1,{Focus:G=function(u=!1){if(p!=N&&pe.set(null),re.set(N),w){u||ie.set([]);return}else ke(N,u)}}=e;N.Focus=G;let ke=function(u,v){let U=v?[...l,u]:[u];ie.set(U)},tt=function(u){let{child_to_swap:v,moveUp:U}=u.detail;var I=o.indexOf(v),k=I+(U?-1:1),S=k>=0&&k<o.length;if(S){let B=[...o];[B[I],B[k]]=[B[k],B[I]],D.set(B)}},nt=function(u){let{target:v,isFocused:U}=u.detail;if(U){var I=de();let S=I.indexOf(v);if(S==1)G();else{var k=I[S-1];re.set(k),ie.set([k])}}n(8,W=W.filter(S=>S!=v.instanceId)),D.set([...o.filter(S=>S!=v.note.id)])};const de=function(){var u=[N];if(O||w){var v=[...z,...j];v.forEach(U=>{if(U!=null){var I=[];I=U.getSortedGenespan(),u=u.concat(I)}})}return u};let Ue=function(u){if(fe){if(!r)switch(u.key){case"ArrowUp":u.shiftKey&&h("SwapChildren",{child_to_swap:y.id,moveUp:!0});break;case"ArrowDown":u.shiftKey&&h("SwapChildren",{child_to_swap:y.id,moveUp:!1});break;case"ArrowLeft":h("Focus",{keepSelection:u.ctrlKey});break;case"Insert":u.preventDefault();var v=oe.addNewChild({parent:y});n(3,O=!0),u.ctrlKey||Te().then(()=>{de().forEach(S=>{S.note==v&&(re.set(S),ie.set([S]))})});break;case"Tab":u.preventDefault(),n(3,O=!O);break;case"Enter":w||(u.preventDefault(),pe.set(N),Te().then(()=>{E.focus(),ke(N,!1)}));break;case"i":if(u.ctrlKey)debugger;break;case"c":u.ctrlKey&&(Ne.copiedInstances=[...l]);break;case"x":u.ctrlKey&&(Ne.copiedInstances=[...l],l.forEach(k=>k.Delete()));break;case"v":u.ctrlKey&&(Ne.copiedInstances.forEach(function(k){y.add(k.note)}),o.length>0&&n(3,O=!0));break;case"Alt":u.preventDefault();break}if(r)switch(u.key){case"Enter":break;case"Alt":u.preventDefault(),pe.set(null);break;case"Tab":u.preventDefault();var U=E.selectionStart,I=E.selectionEnd;n(5,E.value=E.value.substring(0,U)+"	"+E.value.substring(I),E),n(5,E.selectionStart=n(5,E.selectionEnd=U+1,E),E)}}};Re(()=>{window.addEventListener("keydown",Ue)}),wt(()=>{window.removeEventListener("keydown",Ue)}),w&&(Re(G),window.addEventListener("keydown",function(v){let U=function(I){for(var k=de(),S,B=0;B<k.length;B++){var pt=k[B];if(pt==p){S=B;break}}var Ee=S+(I?-1:1),_t=Ee>=0&&Ee<k.length;return _t?k[Ee]:null};if((v.key=="ArrowUp"||v.key=="ArrowDown")&&a==null&&(v.preventDefault(),!v.shiftKey)){let I=v.key=="ArrowUp",k=U(I);k!=null&&(re.set(k),ke(k,v.ctrlKey))}v.key=="Delete"&&l.forEach(I=>{I.Delete()})}));function rt(u,v){q[u?"unshift":"push"](()=>{z[v]=u,n(6,z)})}const it=u=>{G(u.detail.keepSelection)},st=u=>{G(u.ctrlKey)},ot=()=>{n(3,O=!O)};function lt(u){q[u?"unshift":"push"](()=>{E=u,n(5,E)})}function ct(){c=this.value,F.set(c)}const ut=u=>{G(u.ctrlKey)};function at(u,v){q[u?"unshift":"push"](()=>{z[v]=u,n(6,z)})}const ft=u=>{G(u.detail.keepSelection)};function dt(u,v){q[u?"unshift":"push"](()=>{j[v]=u,n(7,j)})}const ht=u=>{G(u.detail.keepSelection)};return t.$$set=u=>{"noteId"in u&&n(2,_=u.noteId),"isReference"in u&&n(0,m=u.isReference),"Focus"in u&&n(1,G=u.Focus)},t.$$.update=()=>{t.$$.dirty[0]&20971520&&n(10,r=a==N),t.$$.dirty[0]&24&&n(4,i=O||i),t.$$.dirty[0]&37748736&&n(9,fe=p===N),t.$$.dirty[0]&12582912&&n(11,s=l.includes(N))},[m,G,_,O,i,E,z,j,W,fe,r,s,o,c,y,w,F,D,tt,nt,f,de,N,l,a,p,rt,it,st,ot,lt,ct,ut,at,ft,dt,ht]}class we extends Ae{constructor(e){super(),Le(this,e,Ut,At,be,{instanceId:20,noteId:2,isReference:0,Focus:1,getSortedGenespan:21},null,[-1,-1])}get instanceId(){return this.$$.ctx[20]}get getSortedGenespan(){return this.$$.ctx[21]}}function Mt(t){let e,n,r,i,s,l,a,p;return{c(){e=L("div"),n=L("button"),n.textContent="Download",r=x(),i=L("button"),s=ve(`Upload \r
      `),l=L("input"),b(n,"id","download_btn"),b(n,"class","svelte-1xmv8yt"),b(l,"type","file"),b(l,"accept",".tnp"),vt(l,"display","none"),b(i,"id","upload_btn"),b(i,"class","svelte-1xmv8yt"),b(e,"id","MenuBar"),b(e,"class","svelte-1xmv8yt")},m(o,c){R(o,e,c),K(e,n),K(e,r),K(e,i),K(i,s),K(i,l),t[4](l),a||(p=[V(n,"click",t[3]),V(l,"change",t[2]),V(i,"click",t[1])],a=!0)},p:P,i:P,o:P,d(o){o&&A(e),t[4](null),a=!1,J(p)}}}function He(t){return t.slice(0,-4)}function Kt(t,e,n){let r,i=function(){r.click()},s=async function(c){var h=r.files;if((h==null?void 0:h.length)==1){var d=oe.notes[0].children.value.length==0,f=h[0],_=await f.text(),m=new ae([]);m.loadFromJSON(JSON.parse(_)),m.Update();var g=oe.Merge(m);g.markup.set(f.name),d&&(document.title=He(f.name))}n(0,r.value="",r)},l=function(){var c=oe.getCopyForDownload(),h=JSON.stringify(c),d=new Blob([h],{type:"application/octet-binary"});a(d),document.title.endsWith("*")&&(document.title=He(document.title))},a=function(c){var h=document.createElement("a");h.setAttribute("href",URL.createObjectURL(c)),h.setAttribute("download",document.title+".tnp"),h.click(),document.addEventListener("keydown",d=>{d.key=="d"&&d.ctrlKey&&(d.preventDefault(),l())}),p()},p=function(){var c=document.title;c[0]=="*"&&(document.title=c.substring(1,c.length))};window.addEventListener("beforeunload",function(c){document.title.endsWith("*")&&c.preventDefault()});function o(c){q[c?"unshift":"push"](()=>{r=c,n(0,r)})}return[r,i,s,l,o]}class Rt extends Ae{constructor(e){super(),Le(this,e,Kt,Mt,be,{})}}function $t(t){let e,n,r,i,s,l;return r=new Rt({}),s=new we({props:{noteId:0}}),{c(){e=L("main"),n=L("div"),ce(r.$$.fragment),i=x(),ce(s.$$.fragment),b(n,"id","MenubarContainer"),b(n,"class","svelte-1l4rrhz"),b(e,"data-testid","my-element"),b(e,"class","svelte-1l4rrhz")},m(a,p){R(a,e,p),K(e,n),ee(r,n,null),K(e,i),ee(s,e,null),l=!0},p:P,i(a){l||(C(r.$$.fragment,a),C(s.$$.fragment,a),l=!0)},o(a){$(r.$$.fragment,a),$(s.$$.fragment,a),l=!1},d(a){a&&A(e),te(r),te(s)}}}class Tt extends Ae{constructor(e){super(),Le(this,e,null,$t,be,{})}}new Tt({target:document.getElementById("app")});
