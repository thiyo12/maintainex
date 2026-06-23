import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Modal, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'
import { conversations } from '../../../../lib/api'
import { useTranslation } from 'react-i18next'

const MOCK: Record<string, any> = {
  m1: { id:'m1', userId:'u1', name:'Saman Kumara', rating:4.8, completedJobs:127, hourlyRate:1500, isVerified:true, badge:'PRO', badgeColor:'#6366F1', categories:['Cleaning','Plumbing'], entityType:'INDIVIDUAL', experienceYears:6, bio:'Expert cleaner and plumber with 6+ years.', skills:['Deep Cleaning','Pipe Repair'], locationName:'Colombo 5' },
  m2: { id:'m2', userId:'u2', name:'Priya Devi', rating:4.9, completedJobs:89, fixedRate:8500, isVerified:true, badge:'Top Rated', badgeColor:'#F59E0B', categories:['Electrical','AC'], entityType:'INDIVIDUAL', experienceYears:4, bio:'Licensed electrician.', skills:['Wiring','AC Service'], locationName:'Nugegoda' },
}

const PAST_WORKS = [
  { id:'w1', title:'Full House Cleaning', image:'https://picsum.photos/seed/work1/200/150' },
  { id:'w2', title:'AC Installation', image:'https://picsum.photos/seed/work2/200/150' },
]

const REVIEWS = [
  { id:'r1', reviewerName:'Amila P.', rating:5, comment:'Excellent work! Very professional.' },
  { id:'r2', reviewerName:'Kamal.', rating:4, comment:'Good service, on time.' },
]

const TIME_SLOTS = ['08:00-10:00','10:00-12:00','12:00-14:00','14:00-16:00','16:00-18:00']

export default function TaskerProfile() {
  const { t } = useTranslation()
  const colors = useColors()
  const s = makeStyles(colors)
  const router = useRouter()
  const { taskerId } = useLocalSearchParams<{ taskerId: string }>()
  const tasker = MOCK[taskerId || ''] || MOCK['m1']

  const [showModal, setShowModal] = useState(false)
  const [qDate, setQDate] = useState('')
  const [qSlot, setQSlot] = useState('')
  const [qMsg, setQMsg] = useState('')
  const [sending, setSending] = useState(false)

  const entityType = tasker.entityType || 'INDIVIDUAL'

  const openQuoteModal = () => {
    setQDate(new Date().toISOString().split('T')[0])
    setQSlot('')
    setQMsg('')
    setShowModal(true)
  }

  const sendEnquiry = async () => {
    const defaultMsg = `Hi ${tasker.name}, I'm interested in your services.\n\nA few questions:\n• Are you available this week?\n• What is your estimated cost?\n• Do you have experience with similar jobs?\n\nPlease let me know, thanks!`
    try {
      const c = await conversations.create({ participantId: tasker.userId, initialMessage: defaultMsg })
      if (c?.id) {
        if (c.existing) {
          await conversations.sendMessage(c.id, defaultMsg).catch(() => {})
        }
        router.push(`/(chat)/${c.id}`)
      } else {
        router.push(`/(chat)/demo_${Date.now()}?testMsg=${encodeURIComponent(defaultMsg)}&testUser=${encodeURIComponent(tasker.name)}`)
      }
    } catch {
      router.push(`/(chat)/demo_${Date.now()}?testMsg=${encodeURIComponent(defaultMsg)}&testUser=${encodeURIComponent(tasker.name)}`)
    }
  }

  const sendQuoteReq = async () => {
    if (!qDate || !qSlot) { Alert.alert('Error','Pick date & time'); return }
    setSending(true)
    const text = `Quote Request\nDate: ${qDate}\nTime: ${qSlot}${qMsg ? '\n\nMessage:\n'+qMsg : ''}`
    try {
      const c = await conversations.create({ participantId: tasker.userId, initialMessage: text })
      setShowModal(false)
      if (c?.id) {
        if (c.existing) {
          await conversations.sendMessage(c.id, text).catch(() => {})
        }
        router.push(`/(chat)/${c.id}`)
      } else {
        setShowModal(false)
        router.push(`/(chat)/demo_${Date.now()}?testMsg=${encodeURIComponent(text)}&testUser=${encodeURIComponent(tasker.name)}`)
      }
    } catch {
      setShowModal(false)
      router.push(`/(chat)/demo_${Date.now()}?testMsg=${encodeURIComponent(text)}&testUser=${encodeURIComponent(tasker.name)}`)
    }
    setSending(false)
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{(tasker.name||'T')[0]}</Text>
          </View>
          <View style={s.info}>
            <View style={s.nameRow}>
              <Text style={s.name}>{tasker.name}</Text>
              {tasker.isVerified && <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />}
            </View>
            <View style={[s.entityBadge,{backgroundColor: entityType==='COMPANY'?'#6366F120':'#10B98120'}]}>
              <Text style={[s.entityBadgeTxt,{color:entityType==='COMPANY'?'#6366F1':'#10B981'}]}>
                {entityType==='COMPANY' ? 'Company' : 'Individual'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={s.statsRow}>
          <View style={s.stat}><Text style={s.statVal}>{tasker.rating?.toFixed(1)||'—'}</Text><Text style={s.statLbl}>Rating</Text></View>
          <View style={s.div} />
          <View style={s.stat}><Text style={s.statVal}>{tasker.completedJobs||0}</Text><Text style={s.statLbl}>Jobs Done</Text></View>
          <View style={s.div} />
          <View style={s.stat}><Text style={s.statVal}>{tasker.experienceYears||'—'}</Text><Text style={s.statLbl}>Experience</Text></View>
        </View>

        {/* ── Rate ── */}
        <View style={s.cardCenter}>
          <Text style={s.rateLbl}>Rate</Text>
          <Text style={s.rateVal}>Rs {tasker.hourlyRate||tasker.fixedRate||'—'}</Text>
          <Text style={s.rateHint}>{tasker.hourlyRate?'per hour':'fixed'}</Text>
        </View>

        {/* ── Services ── */}
        {tasker.categories?.length > 0 && (
          <View style={s.card}>
            <View style={s.sectionH}><Ionicons name="grid-outline" size={16} color={colors.amber} /><Text style={s.sectionT}> Services</Text></View>
            <View style={s.chips}>{tasker.categories.map((c:string,i:number)=><View key={i} style={s.chip}><Text style={s.chipTxt}>{c}</Text></View>)}</View>
          </View>
        )}

        {/* ── Bio ── */}
        {tasker.bio && (
          <View style={s.card}>
            <View style={s.sectionH}><Ionicons name="document-text-outline" size={16} color={colors.amber} /><Text style={s.sectionT}> About</Text></View>
            <Text style={s.bio}>{tasker.bio}</Text>
          </View>
        )}

        {/* ── Skills ── */}
        {tasker.skills?.length > 0 && (
          <View style={s.card}>
            <View style={s.sectionH}><Ionicons name="hammer-outline" size={16} color={colors.amber} /><Text style={s.sectionT}> Skills</Text></View>
            <View style={s.chips}>{tasker.skills.map((sk:string,i:number)=><View key={i} style={[s.chip,{backgroundColor:colors.amberBg}]}><Text style={[s.chipTxt,{color:colors.amberDark}]}>{sk}</Text></View>)}</View>
          </View>
        )}

        {/* ── Location ── */}
        {tasker.locationName && (
          <View style={s.card}>
            <View style={s.sectionH}><Ionicons name="location-outline" size={16} color={colors.amber} /><Text style={s.sectionT}> Location</Text></View>
            <Text style={s.bio}>{tasker.locationName}</Text>
          </View>
        )}

        {/* ── Past Works ── */}
        <View style={s.card}>
          <View style={s.sectionH}><Ionicons name="images-outline" size={16} color={colors.amber} /><Text style={s.sectionT}> Past Works</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
            {PAST_WORKS.map(w=><View key={w.id} style={s.pw}><Image source={{uri:w.image}} style={s.pwImg} /><Text style={s.pwTxt}>{w.title}</Text></View>)}
          </ScrollView>
        </View>

        {/* ── Reviews ── */}
        <View style={s.card}>
          <View style={s.sectionH}><Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.amber} /><Text style={s.sectionT}> Reviews ({REVIEWS.length})</Text></View>
          {REVIEWS.map(r=>(
            <View key={r.id} style={s.review}>
              <Text style={s.reviewName}>{r.reviewerName}</Text>
              <Text style={s.reviewComment}>{r.comment}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View style={[s.bottomBar,{backgroundColor:colors.white,borderTopColor:colors.border}]}>
        <View style={s.bottomInner}>
          <View>
            <Text style={{fontSize:11,color:colors.muted}}>Rate</Text>
            <Text style={[s.bottomPrice,{color:colors.ink}]}>Rs {tasker.hourlyRate||tasker.fixedRate||'—'}</Text>
          </View>
          <View style={{flexDirection:'row',gap:8}}>
            <TouchableOpacity style={[s.btn,s.btnOutline]} onPress={sendEnquiry}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.amber} />
              <Text style={{color:colors.amber,fontSize:12,fontFamily:fonts.bodyMedium}}> Enquiry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn,s.btnSolid]} onPress={openQuoteModal}>
              <Ionicons name="paper-plane-outline" size={14} color="#111827" />
              <Text style={{color:'#111827',fontSize:12,fontFamily:fonts.bodyMedium}}> Quote</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Quote Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={()=>setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,justifyContent:'flex-end'}}>
          <TouchableOpacity style={{flex:1,backgroundColor:'rgba(0,0,0,0.45)'}} activeOpacity={1} onPress={()=>setShowModal(false)} />
          <View style={[s.sheet,{backgroundColor:colors.white}]}>
            <View style={{alignItems:'center',paddingVertical:10}}><View style={{width:36,height:4,borderRadius:2,backgroundColor:colors.border}} /></View>
            <ScrollView contentContainerStyle={{padding:20,paddingBottom:40}}>
              <Text style={{fontSize:18,fontFamily:fonts.headingBold,color:colors.ink}}>Request Quote from {tasker.name}</Text>
              <Text style={{fontSize:13,color:colors.muted,marginBottom:16}}>Select date & time, then send your request</Text>

              {/* Date */}
              <Text style={s.label}>DATE</Text>
              <TextInput style={s.input} value={qDate} onChangeText={setQDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />

              {/* Time */}
              <Text style={s.label}>TIME</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:8}}>
                {TIME_SLOTS.map(sl=>(
                  <TouchableOpacity key={sl} style={[s.slot, qSlot===sl&&{backgroundColor:colors.amberBg,borderColor:colors.amber},{borderColor:colors.border,backgroundColor:colors.surface}]} onPress={()=>setQSlot(sl)}>
                    <Text style={[s.slotTxt, qSlot===sl&&{color:colors.amberDark,fontFamily:fonts.heading},{color:colors.ink}]}>{sl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              <Text style={s.label}>MESSAGE (optional)</Text>
              <TextInput
                style={[s.input,{minHeight:90,textAlignVertical:'top'}]}
                value={qMsg}
                onChangeText={setQMsg}
                placeholder="Ask the tasker for more details about the job..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[s.sendBtn,{backgroundColor:qDate&&qSlot?colors.amber:colors.border}]}
                disabled={!qDate||!qSlot||sending}
                onPress={sendQuoteReq}
              >
                <Text style={{color:qDate&&qSlot?'#111827':colors.muted,fontFamily:fonts.body,fontSize:15}}>
                  {sending ? 'Sending...' : 'Send Quote Request'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const makeStyles = (colors:any) => StyleSheet.create({
  container: { flex:1, backgroundColor: colors.cream },
  scroll: { padding: 16, paddingBottom: 120 },
  header: { flexDirection:'row', alignItems:'center', marginBottom:16 },
  avatar: { width:60, height:60, borderRadius:30, backgroundColor:colors.amber, justifyContent:'center', alignItems:'center', marginRight:14 },
  avatarTxt: { fontSize:24, fontFamily:fonts.heading, color:'#fff' },
  info: { flex:1 },
  nameRow: { flexDirection:'row', alignItems:'center', gap:6 },
  name: { fontSize:20, fontFamily:fonts.headingBold, color:colors.ink },
  entityBadge: { paddingHorizontal:8, paddingVertical:2, borderRadius:4, alignSelf:'flex-start', marginTop:4 },
  entityBadgeTxt: { fontSize:10, fontFamily:fonts.body },
  statsRow: { flexDirection:'row', borderRadius:12, padding:16, marginBottom:12, alignItems:'center', backgroundColor:colors.white },
  stat: { flex:1, alignItems:'center' },
  statVal: { fontSize:18, fontFamily:fonts.headingBold, color:colors.ink },
  statLbl: { fontSize:10, color:colors.muted, marginTop:2 },
  div: { width:1, height:30, backgroundColor:colors.border },
  cardCenter: { borderRadius:12, padding:16, alignItems:'center', marginBottom:12, backgroundColor:colors.white },
  rateLbl: { fontSize:12, color:colors.muted },
  rateVal: { fontSize:26, fontFamily:fonts.heading, color:colors.amber, marginTop:4 },
  rateHint: { fontSize:12, color:colors.muted, marginTop:2 },
  card: { borderRadius:12, padding:14, marginBottom:12, backgroundColor:colors.white },
  sectionH: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  sectionT: { fontSize:15, fontFamily:fonts.bodyMedium, color:colors.ink },
  bio: { fontSize:14, color:colors.muted, lineHeight:20 },
  chips: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip: { backgroundColor:colors.amber+'20', paddingHorizontal:10, paddingVertical:5, borderRadius:8 },
  chipTxt: { fontSize:12, fontFamily:fonts.bodyMedium, color:colors.amberDark },
  pw: { width:160, borderRadius:10, overflow:'hidden', backgroundColor:colors.surface },
  pwImg: { width:160, height:100, backgroundColor:colors.border },
  pwTxt: { fontSize:11, fontFamily:fonts.bodyMedium, color:colors.ink, padding:6 },
  review: { borderTopWidth:1, borderTopColor:colors.border, paddingTop:10, marginTop:10 },
  reviewName: { fontSize:13, fontFamily:fonts.bodyMedium, color:colors.ink },
  reviewComment: { fontSize:13, color:colors.muted, marginTop:4, lineHeight:18 },
  bottomBar: { position:'absolute', bottom:0, left:0, right:0, borderTopWidth:1, paddingBottom:34 },
  bottomInner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12 },
  bottomPrice: { fontSize:18, fontFamily:fonts.heading },
  btn: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:14, paddingVertical:10, borderRadius:10 },
  btnOutline: { borderWidth:1.5, borderColor:colors.amber },
  btnSolid: { backgroundColor:colors.amber },
  sheet: { borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'85%' },
  label: { fontSize:11, fontFamily:fonts.body, textTransform:'uppercase', letterSpacing:0.5, marginTop:14, marginBottom:6, color:colors.muted },
  input: { borderWidth:1.5, borderRadius:14, padding:14, fontSize:14, fontFamily:fonts.body, backgroundColor:colors.surface, borderColor:colors.border, color:colors.ink },
  slot: { paddingVertical:8, paddingHorizontal:14, borderRadius:100, borderWidth:1.5 },
  slotTxt: { fontSize:11, fontFamily:fonts.bodyMedium },
  sendBtn: { flexDirection:'row', justifyContent:'center', alignItems:'center', paddingVertical:16, borderRadius:14, marginTop:20 },
})
