const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: Object.values(GatewayIntentBits).reduce((a, b) => a | b)
});
const axios = require(`axios`);
const http = require("http"); 

/////////////////////////
//環境設定
const url = process.env.GAS_API_URL;
const tokenchannel = process.env.TOKEN_CHANNEL;
const sheetName = process.env.SHEET_NAME;

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
      sheetName: sheetName,
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
    axios.post(url, this.data)
      .then(response => {
      console.log('POSTリクエストが成功しました。');
      this.data.rows.map((user) => {
      //<@!${user.id}>でトークン発行対象者をお知らせチャンネルでメンション
        this.channel.send(`<@!${user.userID}>(id:${user.userID})さん${resprompt}\nmessageID: ${user.messageID}`);
      });
      })
      .catch(error => {
      console.error('POSTリクエストが失敗しました。');
      this.message.reply(errprompt);
    });
  }
  //トークンを発行するメソッド
  insertGas(){
    this.data.action = "insert";
    const resprompt = `さんにトークンを発行します`;
    const errprompt = `トークンの発行に失敗しました`;
    this.postAxios(resprompt,errprompt);
  }
  //トークン発行をキャンセルするメソッド
  deleteGas(){
    this.data.action = "delete";
    const resprompt = `さん、ごめんなさい。さっきのトークン発行はミスでした。`;
    const errprompt = `トークンの発行の削除に失敗しました`;
    this.postAxios(resprompt,errprompt);
  }
}

//////////////////////////////////

client.on("ready", () => {
  console.log(`Bot準備完了！${client.user.tag} でログインしています。`);
  client.user.setPresence({ activity: { name: '投稿チェック' } });
});
client.on("messageCreate", async message => {
  //メッセージ投稿者がBotなら反応しない
  if (message.author.id == client.user.id || message.author.bot) return;
  //自分がメンションされたら反応
  if (message.mentions.has(client.user)) {
    
    //メンションによるトークンの発行
    const channel = client.channels.cache.get(tokenchannel);
    const postGas = new PostGas(channel,message);
    //メンションされているユーザーごとに実行
    message.mentions.users.map((user) =>{
      //メンションされているのがbot以外なら実行
      if(user.id != client.user.id){
        //正規表現で発行枚数を取得
        const regex = /(\d+)枚/; // 「枚」の直前の数字の1回以上の繰り返しを表す正規表現
        const matches = message.content.match(regex);
        //最初に検出された数字
        const integerPart = matches ? parseInt(matches[0]) : null;
        //発行枚数が検出されなければ１
        let issue = integerPart || 1;
        
        //メッセージが送信された日時を日本標準時に変更
        const now = new Date();
        const date = new Intl.DateTimeFormat('ja-JP', timezoneoptions).format(now);
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

client.login(process.env.DISCORD_BOT_TOKEN);

//GASからのPOSTリクエストを受け取る用
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

 /*
 //同じ種類のリアクションが何個あるか数える
 client.on('messageReactionAdd', async (reaction, user) => {
    console.log(reaction.count);
});
*/

