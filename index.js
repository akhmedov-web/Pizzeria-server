import TelegramBot from "node-telegram-bot-api";
import express from "express";
import cors from "cors";

const token = "7915771332:AAF6qS6kxF9Gh-PEkTP8_0SQnNZ8_PF7iSA";
const bot = new TelegramBot(token, { polling: true });
const app = express();

app.use(express.json());
app.use(cors());

// Store user phone numbers
const userPhoneNumbers = new Map();
const userLocations = new Map();

const ADMIN_CHAT_ID = "1113965699"; // Replace with the actual admin's chat ID

// Main bot logic
const main = () => {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
  
    if (text === "/start") {
      await bot.sendMessage(
        chatId,
        `Assalomu alaykum <b>${msg.from.first_name}!</b> \n\n<b>📞Telefon raqamni jo'natish</b> tugmasi orqali ro'yhatdan o'ting!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [
              [{ text: "📞 Telefon raqamni jo'natish", request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true, // This only works for some clients
          },
        }
      );
    }
  
    if (msg.contact) {
      const phoneNumber = msg.contact.phone_number;
      userPhoneNumbers.set(chatId, phoneNumber);
  
      // Step 1: Remove the keyboard
      await bot.sendMessage(chatId, "✅ Raqamingiz qabul qilindi!", {
        reply_markup: {
          remove_keyboard: true, // Ensure the reply keyboard is removed
        },
      });
  
      // Step 2: Send the inline keyboard separately
      await bot.sendMessage(
        chatId,
        `<b>Botga xush kelibsiz!</b>\n\nMenudan o'zingiz xohlagan ovqatni tanlang va biz sizga tezda yetqizib beramiz!`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Menu 📒",
                  web_app: { url: "https://pizzeriademo.vercel.app/" },
                },
                { text: "Kontakt ℹ️", callback_data: "aboutOpt" },
              ],
            ],
          },
        }
      );
    }
  });  

  // Handle callbacks
  bot.on("callback_query", (query) => {
    const chatId = query.message?.chat?.id;

    if (query.data === "aboutOpt") {
      bot.sendMessage(
        chatId,
        `<b>Farovon Milliy Taomlari</b>
        \nBu bot sizga bizning restorantimizdan online buyurtma qilishingizga yordam beradi.
        \n<b>Admin bilan bog'lanish:</b>
☎️ 90 670 16 06
📨 @akhmedov_mailbox`,
        { parse_mode: "HTML" }
      );
    }
  });
};

// Handle incoming orders from the web app
// Handle incoming orders from the web app
app.post("/web-data", async (req, res) => {
  try {
    const { products, userID } = req.body;
    if (!userID || !products || !products.length) {
      return res.status(400).json({ error: "Invalid request data." });
    }

    // ✅ Clear previous location for the user
    userLocations.delete(userID);

    const user = await bot.getChat(userID);
    const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    const userHandle = user.username ? `@${user.username}` : "No username";

    const phoneNumber = userPhoneNumbers.get(userID) || "Unknown";

    const productDetails = products
      .map((item, index) => {
        const totalItemPrice = item.price * item.quantity;
        return `<b>${index + 1}. ${item.title}</b>\n${item.quantity} x ${
          item.price.toLocaleString("uz-UZ", {
            style: "currency",
            currency: "UZS",
            minimumFractionDigits: 0,
          })
        }= ${totalItemPrice.toLocaleString("uz-UZ", {
          style: "currency",
          currency: "UZS",
          minimumFractionDigits: 0,
        })}`;
      })
      .join("\n\n");

    const totalPrice = products
      .reduce((a, c) => a + c.price * c.quantity, 0)
      .toLocaleString("uz-UZ", {
        style: "currency",
        currency: "UZS",
        minimumFractionDigits: 0,
      });

    // Ask for location (new order starts)
    await bot.sendMessage(
      userID,
      `📍Yetqazib berish manzilini kiriting.\nMisol uchun: Xo'ja Kasbi mahallasi, Alisher Navoiy ko'chasi, 8-uy`
    );

    const locationHandler = async (msg) => {
      if (msg.chat.id === userID && msg.text !== "/start") {
        userLocations.set(userID, msg.text); // ✅ Store new location
        const location = userLocations.get(userID) || "Unknown";

        // Confirm order to user
        await bot.sendMessage(
          userID,
          `<b>Buyurtmangiz muvaffaqqiyatli qabul qilindi. ✅</b>
          \n<b>Buyurtma tafsilotlari:</b>\n${productDetails}
          \n<b>Umumiy:</b> ${totalPrice}
          \n<i>⌛Buyurtmani yetqazib berish 35-40minut vaqt olishi mumkin.</i>
          \n<b>Admin bilan bog'lanish:</b>
☎️ 90 670 16 06
📨 @akhmedov_mailbox
          \n<b>Sizga xizmat ko'rsatganimizdan xursandmiz😊</b>`,
          { parse_mode: "HTML" }
        );

        // Notify admin
        await bot.sendMessage(
          ADMIN_CHAT_ID,
          `<b>🚨 Yangi buyurtma!</b>\n\n<b>Ism:</b> ${userName}\n<b>Username:</b> ${userHandle}\n<b>Telefon raqam:</b> ${phoneNumber}\n<b>Manzil:</b> ${location}\n\n<b>Buyurtmalar:</b>\n${productDetails}\n\n<b>Umumiy:</b> ${totalPrice}`,
          { parse_mode: "HTML" }
        );

        // ✅ Remove the handler after handling one location
        bot.removeListener("message", locationHandler);
      }
    };

    // ✅ Attach location listener (but clear old ones first)
    bot.removeListener("message", locationHandler);
    bot.on("message", locationHandler);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

bot.on("polling_error", (error) => console.error("Polling error:", error));

app.listen(process.env.PORT || 8000, () =>
  console.log("Server started on port 8000")
);

main();
