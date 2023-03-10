const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: Object.values(GatewayIntentBits).reduce((a, b) => a | b)
});
const axios = require(`axios`);
const http = require("http"); 

/////////////////////////
//環境設定
//APIキーなどの設定読み込み
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GAS_API_URL = process.env.GAS_API_URL;
const ANNOUNCE_CHANNEL = process.env.TOKEN_CHANNEL;
const ISSUE_TOKEN_SHEET = process.env.SHEET_NAME;
//タイムゾーンを日本標準時に変更するためのオプション（海外サーバーで実行されたとき用）
const timezoneoptions = {
  timeZone: 'Asia/Tokyo',
  hour12: false, 
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit'
};

/////////////////////////////////////
//GASへポストするデータとメソッドをclass化
class PostGas {
  constructor(channel,message) {
    //GASへポストするデータ
    this.data =  {
      action: "",
      sheetName: ISSUE_TOKEN_SHEET, //トークン発行ならこのシート、他のシートにもアップロードするなら要検討
      rows: []
    }
    this.channel = channel; //トークンが発行されたことをお知らせするチャンネル
    this.message = message;//返信用
  }
  //更新する発行データを追加するメソッド
  pushdata(data){
    this.data.rows.push(data);
  }
  postAxios(resprompt,errprompt){
    axios.post(GAS_API_URL, this.data)
      .then(response => {
        console.log('POSTリクエストが成功しました。');
        this.channel.send(resprompt);
      })
      .catch(error => {
        console.error('POSTリクエストが失敗しました。');
        this.message.reply(errprompt);
    });
  }
  //トークンを発行するメソッド
  insertGas(){
    this.data.action = "insert";
    let resprompt = ``;
    this.data.rows.map((user)=>{
      resprompt = `${resprompt}<@!${user.userID}>さん\n`;
    });
    resprompt = `${resprompt}${this.data.rows[0].issue}枚のMLTTが発行されました`;
    const errprompt = `<@${this.data.rows[0].issuerID}>MLTTの発行に失敗しました`;
    this.postAxios(resprompt,errprompt);
  }
  //トークン発行をキャンセルするメソッド
  deleteGas(){
    this.data.action = "delete";
    let resprompt = ``;
    this.data.rows.map((user)=>{
      resprompt = `${resprompt}<@!${user.userID}>さん\n`;
    });
    resprompt = `さっきのMLTT発行は取り消されました。`;
    const errprompt = `<@${this.data.rows[0].issuerID}>MLTT発行の削除に失敗しました`;
    this.postAxios(resprompt,errprompt);
  }
}

//////////////////////////////////
//ログイン状態の設定
client.on("ready", () => {
  console.log(`Bot準備完了！${client.user.tag} でログインしています。`);
  client.user.setPresence({ activity: { name: '投稿チェック' } });
});

///////////////////////////////
//メッセージが投稿されたときの反応
client.on("messageCreate", async message => {
  //メッセージ投稿者がBotなら反応しない
  if (message.author.id == client.user.id || message.author.bot) return;
  //自分がメンションされたら反応
  //メンションによるトークンの発行
  if (message.mentions.has(client.user)) {
    const channel = client.channels.cache.get(ANNOUNCE_CHANNEL);
    const postGas = new PostGas(channel,message);
    //正規表現で発行枚数を取得
    const regex = /(\d+)枚/; // 「枚」の直前の数字の1回以上の繰り返しを表す正規表現
    const matches = message.content.match(regex);
    const integerPart = matches ? parseInt(matches[0]) : null;//最初に検出された数字
    let issue = integerPart || 1;//発行枚数が検出されなければ１
    //メッセージが送信された日時を日本標準時に変更
    const now = new Date();
    const date = new Intl.DateTimeFormat('ja-JP', timezoneoptions).format(now);
        
    //メンションされているユーザーごとに実行
    message.mentions.users.map((user) =>{
      //メンションされているのがbot以外なら実行
      if(user.id != client.user.id){
        //GASへ送信するデータ形式の作成
        let issuedata = {
          messageID: message.id,
          date: date,
          userID: user.id,
          userName: user.tag,
          issuerID: message.author.id,
          issuerName: message.author.tag,
          issue: issue};
        //送信するデータを追加
        postGas.pushdata(issuedata);
      }
    });
    //GASへ発行データをPOST
    postGas.insertGas();
  }//メンションでの反応はここまで  
});

//BotのDiscordへのログイン
client.login(DISCORD_BOT_TOKEN);

//Glitchを寝かせないため、GASからのPOSTリクエストを受け取る
http
  .createServer( (request, response) => {
    console.log('post from gas')
    response.end("Discord bot is active now.");
  })
  .listen(3000);


//リアクションに反応するコード
// client.on('messageReactionAdd', (reaction, user) => {
//   const message = reaction.message;
//   //メッセージ送信元のuserクラスの取得
//   const member = message.author;
//   console.log(`${message.guild} で ${user.tag} が ${member.tag} に ${reaction.emoji.name} をリアクションしました${message.id}`);
//   reaction.message.channel.send(`${message.guild} で ${user.tag} が ${member.tag} に ${reaction.emoji.name} をリアクションしました。\n
//   messageid: ${message.id}`);
// });